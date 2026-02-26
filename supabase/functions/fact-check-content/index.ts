import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';
import { fetchNewsArticles, formatArticlesForPrompt } from '../_shared/newsapi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string' || content.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo é obrigatório (mínimo 20 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (content.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo muito longo (máximo 10000 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const creditCheck = await checkUserCredits(supabase, user.id, CREDIT_COSTS.FACT_CHECK);
    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.FACT_CHECK}` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const politicalProfile = await fetchPoliticalProfile(supabase, user.id);
    const politicalContext = buildPoliticalContext(politicalProfile);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Extract key terms and search NewsAPI for verification ----
    // Extract main entities/claims from the content for searching
    const contentSnippet = content.trim().substring(0, 500);
    // Extract proper nouns and key terms (names, parties, places)
    const keyTerms = contentSnippet
      .split(/[\s,.\-;:!?()"""'']+/)
      .filter((w: string) => w.length > 3 && /^[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ]/.test(w))
      .slice(0, 8)
      .join(' ');

    const searchQuery = keyTerms || contentSnippet.substring(0, 100);
    const articles = await fetchNewsArticles(searchQuery, { pageSize: 15 });
    const newsContext = formatArticlesForPrompt(articles);

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const prompt = `${politicalContext}

# MISSÃO: VERIFICADOR DE CONTEÚDO (FACT-CHECK) COM FONTES REAIS

Data de hoje: ${today}

Você é um editor e fact-checker profissional especializado em comunicação política.

## CONTEÚDO A SER VERIFICADO:
"${content.trim()}"

## NOTÍCIAS REAIS ENCONTRADAS (últimas 24 horas via NewsAPI):
${newsContext}

## TAREFA
Analise o conteúdo acima CRUZANDO com as notícias reais encontradas. Para cada afirmação no texto:

1. **Verifique se há correspondência** com as notícias reais — confirme ou desminta com base nos fatos
2. **Cite as fontes** — mencione o nome do veículo e a data de publicação da notícia que comprova ou desmente
3. **Identifique afirmações sem verificação possível** — quando não houver notícia correspondente

Categorize cada alerta como:
- "imprecisao" — Informação que contradiz fontes reais
- "sem_fonte" — Afirmação que não tem comprovação nas fontes consultadas
- "exagero" — Exagero ou generalização perigosa
- "risco_imagem" — Frase que pode ser usada contra o político
- "desinformacao" — Conteúdo que se assemelha a desinformação
- "confirmado" — Afirmação confirmada por fontes reais

IMPORTANTE:
- Baseie-se SOMENTE nas notícias reais fornecidas. Não invente fontes.
- Para cada alerta, indique qual fonte confirma ou contradiz a afirmação.
- Se não houver notícias relevantes, informe que não foi possível verificar com fontes recentes.

Atribua um score de confiabilidade de 0 a 100:
- 90-100: Excelente, afirmações confirmadas por fontes
- 70-89: Bom, mas algumas afirmações sem verificação
- 50-69: Atenção, há contradições com fontes reais
- 0-49: Crítico, várias imprecisões detectadas`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "fact_check_result",
            description: "Return fact-check analysis results with real sources",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score de confiabilidade 0-100" },
                verdict: { type: "string", enum: ["excelente", "bom", "atencao", "critico"], description: "Veredicto geral" },
                alerts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["imprecisao", "sem_fonte", "exagero", "risco_imagem", "desinformacao", "confirmado"] },
                      severity: { type: "string", enum: ["alta", "media", "baixa"] },
                      text: { type: "string", description: "Trecho do conteúdo analisado" },
                      explanation: { type: "string", description: "Explicação do problema ou confirmação" },
                      suggestion: { type: "string", description: "Sugestão de correção ou validação" },
                      source: { type: "string", description: "Nome do veículo/fonte que comprova ou contradiz (se disponível)" },
                      sourceUrl: { type: "string", description: "URL da fonte (se disponível)" },
                      sourceDate: { type: "string", description: "Data da publicação da fonte (se disponível)" },
                    },
                    required: ["type", "severity", "text", "explanation", "suggestion"],
                    additionalProperties: false,
                  },
                },
                overallSuggestion: { type: "string", description: "Recomendação geral para o conteúdo" },
                sources: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Nome do veículo" },
                      url: { type: "string", description: "URL da notícia" },
                      title: { type: "string", description: "Título da notícia" },
                      date: { type: "string", description: "Data de publicação" },
                    },
                    required: ["name", "title"],
                    additionalProperties: false,
                  },
                  description: "Lista de todas as fontes consultadas para esta verificação",
                },
              },
              required: ["score", "verdict", "alerts", "overallSuggestion", "sources"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "fact_check_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result = { score: 0, verdict: 'critico', alerts: [], overallSuggestion: '', sources: [] };

    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, user.id, CREDIT_COSTS.FACT_CHECK);
    if (deductResult.success) {
      await recordUserCreditUsage(supabase, {
        userId: user.id,
        teamId: creditCheck.teamId,
        actionType: 'FACT_CHECK',
        creditsUsed: CREDIT_COSTS.FACT_CHECK,
        creditsBefore: creditCheck.currentCredits,
        creditsAfter: deductResult.newCredits,
        description: `Verificação de conteúdo`,
      });
    }

    return new Response(
      JSON.stringify({
        ...result,
        articlesFound: articles.length,
        creditsUsed: CREDIT_COSTS.FACT_CHECK,
        remainingCredits: deductResult.newCredits,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error("fact-check-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
