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
    const { fakeNewsText } = await req.json();

    if (!fakeNewsText || typeof fakeNewsText !== 'string' || fakeNewsText.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Texto da fake news é obrigatório (mínimo 10 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fakeNewsText.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Texto muito longo (máximo 5000 caracteres)' }),
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

    const creditCheck = await checkUserCredits(supabase, user.id, CREDIT_COSTS.FAKE_NEWS_RESPOND);
    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.FAKE_NEWS_RESPOND}` }),
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

# MISSÃO: GERADOR DE RESPOSTAS A FAKE NEWS

Você é um especialista em comunicação política e gestão de crises, com ampla experiência em combate à desinformação.

## FAKE NEWS / ATAQUE RECEBIDO:
"${fakeNewsText.trim()}"

## TAREFA
Gere 3 versões de resposta para combater essa fake news / ataque:

1. **Nota Oficial** — Tom formal e institucional, para ser divulgada como comunicado oficial. Deve ser clara, factual e categórica.

2. **Resposta para Redes Sociais** — Tom adequado ao perfil político, engajante, direta. Deve funcionar em plataformas como Instagram e Twitter/X. Inclua hashtags relevantes.

3. **Pontos-chave para Argumentação** — Lista de argumentos e dados que podem ser usados em entrevistas, debates ou conversas. Formato bullet points.

IMPORTANTE:
- Todas as respostas devem respeitar o tom de voz e as linhas vermelhas do perfil político
- Nunca ataque pessoalmente, foque nos fatos
- Promova transparência e autenticidade
- Use linguagem que promova deliberação, não polarização`;

    const { callGemini } = await import('../_shared/geminiClient.ts');

    const geminiResult = await callGemini({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: "user", content: prompt }],
      tools: [{
        type: "function",
        function: {
          name: "generate_responses",
          description: "Generate 3 response versions to counter fake news",
          parameters: {
            type: "object",
            properties: {
              officialNote: { type: "string" },
              socialMediaResponse: { type: "string" },
              keyArguments: { type: "array", items: { type: "string" } },
              analysis: { type: "string" },
            },
            required: ["officialNote", "socialMediaResponse", "keyArguments", "analysis"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_responses" } },
    });

    if (!geminiResult.ok) {
      if (geminiResult.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.error("Gemini error:", geminiResult.status);
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let result = { officialNote: '', socialMediaResponse: '', keyArguments: [], analysis: '' };

    if (geminiResult.toolCall) {
      result = geminiResult.toolCall.args;
    }

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, user.id, CREDIT_COSTS.FAKE_NEWS_RESPOND);
    if (deductResult.success) {
      await recordUserCreditUsage(supabase, {
        userId: user.id,
        teamId: creditCheck.teamId,
        actionType: 'FAKE_NEWS_RESPOND',
        creditsUsed: CREDIT_COSTS.FAKE_NEWS_RESPOND,
        creditsBefore: creditCheck.currentCredits,
        creditsAfter: deductResult.newCredits,
        description: `Resposta a fake news`,
      });
    }

    return new Response(
      JSON.stringify({ ...result, creditsUsed: CREDIT_COSTS.FAKE_NEWS_RESPOND, remainingCredits: deductResult.newCredits }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error("fake-news-respond error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
