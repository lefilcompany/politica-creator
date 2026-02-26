import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';

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

    const prompt = `${politicalContext}

# MISSÃO: VERIFICADOR DE CONTEÚDO (FACT-CHECK)

Você é um editor e fact-checker profissional especializado em comunicação política.

## CONTEÚDO A SER VERIFICADO:
"${content.trim()}"

## TAREFA
Analise o conteúdo acima antes da publicação e identifique:

1. **Afirmações verificáveis** — Dados, números, estatísticas que precisam de fonte
2. **Imprecisões** — Informações que podem estar incorretas ou desatualizadas
3. **Exageros ou generalizações perigosas** — Frases absolutas (sempre, nunca, todos) sem embasamento
4. **Linguagem que pode ser interpretada como desinformação** — Mesmo sem intenção
5. **Riscos de imagem** — Frases que podem ser tiradas de contexto ou usadas contra o político
6. **Sugestões de melhoria** — Como tornar o texto mais preciso e confiável

Atribua um score de confiabilidade de 0 a 100:
- 90-100: Excelente, pronto para publicação
- 70-89: Bom, mas precisa de pequenos ajustes
- 50-69: Atenção, tem problemas que devem ser corrigidos
- 0-49: Crítico, não publicar sem revisão profunda`;

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
            description: "Return fact-check analysis results",
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
                      type: { type: "string", enum: ["imprecisao", "sem_fonte", "exagero", "risco_imagem", "desinformacao"] },
                      severity: { type: "string", enum: ["alta", "media", "baixa"] },
                      text: { type: "string", description: "Trecho problemático" },
                      explanation: { type: "string", description: "Explicação do problema" },
                      suggestion: { type: "string", description: "Sugestão de correção" },
                    },
                    required: ["type", "severity", "text", "explanation", "suggestion"],
                    additionalProperties: false,
                  },
                },
                overallSuggestion: { type: "string", description: "Recomendação geral para o conteúdo" },
              },
              required: ["score", "verdict", "alerts", "overallSuggestion"],
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
    let result = { score: 0, verdict: 'critico', alerts: [], overallSuggestion: '' };

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
      JSON.stringify({ ...result, creditsUsed: CREDIT_COSTS.FACT_CHECK, remainingCredits: deductResult.newCredits }),
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
