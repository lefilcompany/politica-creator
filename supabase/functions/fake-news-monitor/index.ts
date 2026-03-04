import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';
import { fetchNewsMultiQuery, formatArticlesForPrompt } from '../_shared/newsapi.ts';
import { callGemini } from '../_shared/geminiClient.ts';

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
    const { keywords, politicianName, party } = await req.json();

    if (!keywords || typeof keywords !== 'string' || keywords.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Termos de busca são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Credits check
    const creditCheck = await checkUserCredits(supabase, user.id, CREDIT_COSTS.FAKE_NEWS_MONITOR);
    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.FAKE_NEWS_MONITOR}` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const politicalProfile = await fetchPoliticalProfile(supabase, user.id);
    const politicalContext = buildPoliticalContext(politicalProfile);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const nameForSearch = politicianName || politicalProfile?.political_role || 'político';
    const partyForSearch = party || politicalProfile?.political_party || '';

    // ---- BUSCA REAL via NewsAPI (últimos 7 dias, multi-query) ----
    const queries = [
      `${keywords.trim()} ${nameForSearch}`,
      `${keywords.trim()} ${partyForSearch}`,
      keywords.trim(),
    ].filter(q => q.trim().length > 3);
    const articles = await fetchNewsMultiQuery(queries, { pageSize: 10, days: 7 });
    const newsContext = formatArticlesForPrompt(articles);

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const prompt = `${politicalContext}

# MISSÃO: MONITOR DE FAKE NEWS — ANÁLISE DE NOTÍCIAS REAIS

Data de hoje: ${today}

Você é um analista especializado em comunicação política e combate à desinformação.

## CONTEXTO
- Político: ${nameForSearch}
- Partido: ${partyForSearch}
- Termos de busca: ${keywords.trim()}

## NOTÍCIAS REAIS ENCONTRADAS (últimos 7 dias via NewsAPI):
${newsContext}

## TAREFA
Com base nas notícias REAIS listadas acima, analise cada uma e classifique como:
- "fake_news" - Informação comprovadamente falsa ou manipulada
- "ataque_infundado" - Ataque sem base factual
- "critica_legitima" - Crítica com fundamento que merece atenção
- "alerta" - Conteúdo que merece monitoramento

Para cada item, atribua um nível de urgência:
- "alta" - Requer resposta imediata
- "media" - Deve ser acompanhado
- "baixa" - Monitoramento preventivo

IMPORTANTE:
- Baseie-se SOMENTE nas notícias reais fornecidas acima.
- Inclua a fonte (nome do veículo) e a data de publicação.
- Se não houver notícias relevantes, retorne uma lista vazia com uma mensagem explicativa.
- Gere entre 0 e ${Math.min(articles.length, 10)} resultados.`;

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
            name: "monitor_results",
            description: "Return fake news monitoring results based on real news articles",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Título resumido da menção" },
                      summary: { type: "string", description: "Resumo do conteúdo encontrado" },
                      classification: { type: "string", enum: ["fake_news", "ataque_infundado", "critica_legitima", "alerta"] },
                      urgency: { type: "string", enum: ["alta", "media", "baixa"] },
                      suggestedAction: { type: "string", description: "Ação sugerida para lidar com essa menção" },
                      source: { type: "string", description: "Nome do veículo / fonte da notícia" },
                      publishedAt: { type: "string", description: "Data de publicação" },
                      url: { type: "string", description: "URL da notícia original (se disponível)" },
                    },
                    required: ["title", "summary", "classification", "urgency", "suggestedAction"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string", description: "Resumo geral do cenário encontrado nas últimas 24h" },
              },
              required: ["results", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "monitor_results" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let results = [];
    let monitorSummary = '';
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      results = parsed.results || [];
      monitorSummary = parsed.summary || '';
    }

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, user.id, CREDIT_COSTS.FAKE_NEWS_MONITOR);
    if (deductResult.success) {
      await recordUserCreditUsage(supabase, {
        userId: user.id,
        teamId: creditCheck.teamId,
        actionType: 'FAKE_NEWS_MONITOR',
        creditsUsed: CREDIT_COSTS.FAKE_NEWS_MONITOR,
        creditsBefore: creditCheck.currentCredits,
        creditsAfter: deductResult.newCredits,
        description: `Monitor de fake news: ${keywords.trim().substring(0, 50)}`,
      });
    }

    return new Response(
      JSON.stringify({
        results,
        summary: monitorSummary,
        articlesFound: articles.length,
        creditsUsed: CREDIT_COSTS.FAKE_NEWS_MONITOR,
        remainingCredits: deductResult.newCredits,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error("fake-news-monitor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
