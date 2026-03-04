import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';
import { fetchNewsMultiQuery, formatArticlesForPrompt } from '../_shared/newsapi.ts';

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

    // Gemini API key is checked by geminiClient.ts

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

    const { callGemini } = await import('../_shared/geminiClient.ts');

    const geminiResult = await callGemini({
      model: 'google/gemini-2.5-flash',
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
                    title: { type: "string" },
                    summary: { type: "string" },
                    classification: { type: "string", enum: ["fake_news", "ataque_infundado", "critica_legitima", "alerta"] },
                    urgency: { type: "string", enum: ["alta", "media", "baixa"] },
                    suggestedAction: { type: "string" },
                    source: { type: "string" },
                    publishedAt: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["title", "summary", "classification", "urgency", "suggestedAction"],
                },
              },
              summary: { type: "string" },
            },
            required: ["results", "summary"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "monitor_results" } },
    });

    if (!geminiResult.ok) {
      if (geminiResult.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.error("Gemini error:", geminiResult.status);
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let results = [];
    let monitorSummary = '';
    
    if (geminiResult.toolCall) {
      results = geminiResult.toolCall.args.results || [];
      monitorSummary = geminiResult.toolCall.args.summary || '';
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
