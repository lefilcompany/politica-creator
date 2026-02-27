import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CREDIT_COSTS } from "../_shared/creditCosts.ts";
import { deductCredits } from "../_shared/userCredits.ts";
import { recordCreditUsage } from "../_shared/creditHistory.ts";
import { searchNews } from "../_shared/newsapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    const { subject, crisisType, additionalContext } = await req.json();

    if (!subject || subject.trim().length < 5) {
      throw new Error("Descreva o assunto com pelo menos 5 caracteres");
    }
    if (!crisisType) {
      throw new Error("Selecione o tipo de crise");
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, team_id, political_role, political_party, biography, tone_of_voice")
      .eq("id", user.id)
      .single();

    if (!profile?.team_id) throw new Error("Usuário sem equipe");

    // Deduct credits
    const { data: team } = await supabase
      .from("teams")
      .select("credits")
      .eq("id", profile.team_id)
      .single();

    if (!team || team.credits < CREDIT_COSTS.CRISIS_ANALYSIS) {
      return new Response(JSON.stringify({
        error: "Créditos insuficientes",
        required: CREDIT_COSTS.CRISIS_ANALYSIS,
        available: team?.credits || 0,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Search for related news (precedentes)
    let newsContext = "";
    let articlesFound = 0;
    try {
      const newsResults = await searchNews(subject, 5);
      if (newsResults && newsResults.length > 0) {
        articlesFound = newsResults.length;
        newsContext = newsResults.map((n: any, i: number) =>
          `[${i + 1}] "${n.title}" — ${n.source?.name || 'Fonte desconhecida'} (${n.publishedAt?.slice(0, 10) || 'sem data'})\nResumo: ${n.description || 'Sem resumo'}`
        ).join("\n\n");
      }
    } catch (e) {
      console.error("News search error:", e);
    }

    const crisisTypeLabels: Record<string, string> = {
      corruption: "Denúncia de desvio / corrupção",
      fake_news: "Fake news / boato coordenado",
      out_of_context: "Vídeo ou áudio fora de contexto",
      communication_error: "Erro real de comunicação (gafe)",
      public_policy: "Crise de política pública (fato social grave)",
    };

    const crisisLabel = crisisTypeLabels[crisisType] || crisisType;

    const prompt = `Você é um consultor político sênior especializado em gestão de crises. Analise a situação descrita e produza um relatório completo de sala de situação.

## CONTEXTO DO POLÍTICO
- Nome: ${profile.name || "Não informado"}
- Cargo: ${profile.political_role || "Não informado"}
- Partido: ${profile.political_party || "Não informado"}
- Tom de voz habitual: ${profile.tone_of_voice || "Institucional"}
- Biografia: ${profile.biography || "Não informada"}

## SITUAÇÃO DE CRISE
- Assunto: ${subject}
- Tipo classificado: ${crisisLabel}
- Contexto adicional: ${additionalContext || "Nenhum"}

## NOTÍCIAS ENCONTRADAS (últimos 7 dias)
${newsContext || "Nenhuma notícia recente encontrada sobre o tema."}
${articlesFound > 0 ? `(${articlesFound} artigos encontrados)` : ""}

## INSTRUÇÕES
Responda EXCLUSIVAMENTE em JSON válido com esta estrutura:

{
  "precedentes": {
    "encontrados": true/false,
    "resumo": "Breve resumo dos precedentes encontrados (ou 'Nenhum precedente relevante identificado')",
    "casos": [
      {
        "titulo": "Título do caso precedente",
        "data": "Data aproximada",
        "desfecho": "Como o caso se resolveu",
        "licao": "Lição aplicável à crise atual"
      }
    ]
  },
  "diagnostico": {
    "gravidade": "critica" | "alta" | "media" | "baixa",
    "velocidade_propagacao": "viral" | "rapida" | "moderada" | "lenta",
    "tipo_confirmado": "${crisisType}",
    "resumo_executivo": "Resumo de 2-3 frases da crise",
    "fatores_agravantes": ["lista de fatores que podem piorar"],
    "fatores_atenuantes": ["lista de fatores que podem ajudar"]
  },
  "nota_oficial": {
    "titulo": "Título da nota",
    "corpo": "Texto completo da nota oficial proposta (3-5 parágrafos, tom ${profile.tone_of_voice || 'institucional'})",
    "pontos_chave": ["3-5 pontos que a nota deve garantir que transmite"]
  },
  "plano_acao": {
    "primeiras_2h": ["Ações imediatas nas primeiras 2 horas"],
    "primeiras_24h": ["Ações nas primeiras 24 horas"],
    "proxima_semana": ["Ações de médio prazo"]
  },
  "riscos": [
    {
      "descricao": "Descrição do risco",
      "probabilidade": "alta" | "media" | "baixa",
      "mitigacao": "Como mitigar"
    }
  ],
  "o_que_nao_fazer": ["Lista de erros comuns a evitar neste tipo de crise"]
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const aiResponse = await fetch("https://ai-gateway.lovable.dev/api/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      throw new Error("Falha na análise de crise");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("Resposta vazia da IA");

    let result;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      throw new Error("Falha ao interpretar resposta da IA");
    }

    // Deduct credits
    await deductCredits(supabase, profile.team_id, CREDIT_COSTS.CRISIS_ANALYSIS);
    await recordCreditUsage(supabase, {
      userId: user.id,
      teamId: profile.team_id,
      actionType: "CRISIS_ANALYSIS",
      creditsUsed: CREDIT_COSTS.CRISIS_ANALYSIS,
      description: `Análise de crise: ${crisisLabel}`,
    });

    return new Response(JSON.stringify({
      ...result,
      articlesFound,
      crisisType,
      crisisLabel,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Crisis analysis error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro interno",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
