import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { content, brandId, context } = body;

    if (!content || content.trim().length < 20) {
      return new Response(JSON.stringify({ error: 'O texto precisa ter pelo menos 20 caracteres.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check credits
    const creditCost = CREDIT_COSTS.ANALYZE_REPERCUSSION;
    const creditCheck = await checkUserCredits(supabase, user.id, creditCost);
    if (!creditCheck.hasCredits) {
      return new Response(JSON.stringify({
        error: 'Créditos insuficientes',
        required: creditCost,
        available: creditCheck.currentCredits,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch political profile and brand data in parallel
    const [politicalProfile, brandData] = await Promise.all([
      fetchPoliticalProfile(supabase, user.id),
      brandId ? supabase.from('brands').select('*').eq('id', brandId).single().then(r => r.data) : null,
    ]);

    const politicalContext = buildPoliticalContext(politicalProfile);

    // Build candidate context
    const candidateContext: string[] = [];
    if (politicalProfile) {
      const pp = politicalProfile;
      if (pp.political_role) candidateContext.push(`Cargo: ${pp.political_role}`);
      if (pp.political_party) candidateContext.push(`Partido: ${pp.political_party}`);
      if (pp.political_level) candidateContext.push(`Nível: ${pp.political_level}`);
      if (pp.mandate_stage) candidateContext.push(`Fase: ${pp.mandate_stage}`);
      if (pp.tone_of_voice) candidateContext.push(`Tom de voz habitual: ${pp.tone_of_voice}`);
      if (pp.focus_areas?.length) candidateContext.push(`Áreas de foco: ${pp.focus_areas.join(', ')}`);
      if (pp.biography) candidateContext.push(`Bio: ${pp.biography.substring(0, 500)}`);
      if (pp.red_lines) candidateContext.push(`LINHAS VERMELHAS: ${pp.red_lines}`);
    }
    if (brandData) {
      candidateContext.push(`Identidade: "${brandData.name}" | Valores: ${brandData.values || 'N/A'} | Promessa: ${brandData.promise || 'N/A'}`);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `Você é um analista de comunicação política sênior especializado em repercussão de conteúdo digital.

Sua tarefa é analisar um texto/conteúdo político e avaliar sua PROBABILIDADE DE REPERCUSSÃO COM SUBSTÂNCIA, separando repercussão positiva de ruído efêmero e risco negativo.

## PERFIL DO CANDIDATO/AUTOR:
${candidateContext.length > 0 ? candidateContext.join('\n') : 'Não disponível'}

${politicalContext ? `## CONTEXTO POLÍTICO:\n${politicalContext.substring(0, 1000)}` : ''}

${context ? `## CONTEXTO ADICIONAL:\n${context}` : ''}

## DIMENSÕES DE AVALIAÇÃO (0 a 5 cada):

### A) Substância Pública
- Tem dado concreto? Tem entrega real? Tem proposta executável?
- Evita promessa vaga ou populismo sem base?
- 0 = puro populismo vazio | 5 = proposta concreta com evidência

### B) Conexão Local
- O texto "cheira" a cidade/território? Menciona problema real + referência concreta?
- Fala a linguagem da comunidade? Tem chão?
- 0 = genérico demais | 5 = hiperlocal com identificação imediata

### C) Novidade Legítima
- Traz fato novo verificável ou ângulo original?
- Contribui com algo que ainda não foi dito?
- 0 = reciclagem de lugar-comum | 5 = fato/ângulo genuinamente novo

### D) Polarização e Risco
- NOTA INVERTIDA: quanto MENOR a polarização, MELHOR o score
- Linguagem inflamatória? Acusações sem prova? Generalizações?
- 0 = altamente inflamatório e arriscado | 5 = equilibrado e responsável

### E) Aderência ao "Quem É"
- Coerente com histórico, tom e valores do candidato?
- Soa autêntico ou artificial?
- 0 = totalmente fora de personagem | 5 = perfeitamente alinhado

## CLASSIFICAÇÃO FINAL:
Com base nos scores, classifique em UMA das três categorias:
1. **repercussao_positiva** — Score alto em A+B+C, D≥3, E≥3. Conteúdo com substância real que tende a gerar engajamento qualificado.
2. **risco_negativo** — D≤2 ou combinação de baixa substância com alta polarização. Pode viralizar mas com dano à imagem.
3. **ruido_efemero** — Scores medianos em tudo. Não vai gerar dano mas também não vai repercutir. "Entra por um ouvido e sai pelo outro."

## SUGESTÕES DE AJUSTE:
Para cada dimensão com score ≤ 3, forneça UMA sugestão concreta e acionável de como melhorar o texto.

## REGRAS:
- Seja direto e honesto, mesmo que o texto seja ruim
- Justifique cada nota com 1-2 frases
- Sugestões devem ser práticas, não teóricas
- Considere o contexto político brasileiro atual`;

    console.log('🔍 Analyzing repercussion...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise o seguinte conteúdo político:\n\n---\n${content}\n---` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_repercussion",
            description: "Analisa a probabilidade de repercussão com substância de um conteúdo político",
            parameters: {
              type: "object",
              properties: {
                dimensoes: {
                  type: "object",
                  properties: {
                    substancia_publica: {
                      type: "object",
                      properties: {
                        score: { type: "number", minimum: 0, maximum: 5 },
                        justificativa: { type: "string" }
                      },
                      required: ["score", "justificativa"]
                    },
                    conexao_local: {
                      type: "object",
                      properties: {
                        score: { type: "number", minimum: 0, maximum: 5 },
                        justificativa: { type: "string" }
                      },
                      required: ["score", "justificativa"]
                    },
                    novidade_legitima: {
                      type: "object",
                      properties: {
                        score: { type: "number", minimum: 0, maximum: 5 },
                        justificativa: { type: "string" }
                      },
                      required: ["score", "justificativa"]
                    },
                    polarizacao_risco: {
                      type: "object",
                      properties: {
                        score: { type: "number", minimum: 0, maximum: 5 },
                        justificativa: { type: "string" }
                      },
                      required: ["score", "justificativa"]
                    },
                    aderencia_identidade: {
                      type: "object",
                      properties: {
                        score: { type: "number", minimum: 0, maximum: 5 },
                        justificativa: { type: "string" }
                      },
                      required: ["score", "justificativa"]
                    }
                  },
                  required: ["substancia_publica", "conexao_local", "novidade_legitima", "polarizacao_risco", "aderencia_identidade"]
                },
                classificacao: {
                  type: "string",
                  enum: ["repercussao_positiva", "risco_negativo", "ruido_efemero"]
                },
                resumo: {
                  type: "string",
                  description: "Resumo executivo de 2-3 frases sobre o potencial de repercussão"
                },
                sugestoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      dimensao: { type: "string" },
                      sugestao: { type: "string" }
                    },
                    required: ["dimensao", "sugestao"]
                  }
                }
              },
              required: ["dimensoes", "classificacao", "resumo", "sugestoes"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_repercussion" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error(`AI gateway error: ${status}`, errorText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos da plataforma esgotados.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();

    let analysis;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content2 = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content2.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse analysis from AI response');
      }
    }

    console.log('✅ Repercussion analysis complete:', analysis.classificacao);

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, user.id, creditCost);
    if (!deductResult.success) {
      return new Response(JSON.stringify({ error: deductResult.error }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record credit usage
    await recordUserCreditUsage(supabase, {
      userId: user.id,
      teamId: creditCheck.teamId,
      actionType: 'ANALYZE_REPERCUSSION',
      creditsUsed: creditCost,
      creditsBefore: creditCheck.currentCredits,
      creditsAfter: deductResult.newCredits,
      description: `Análise de repercussão: ${content.substring(0, 50)}...`,
    });

    return new Response(JSON.stringify({
      success: true,
      analysis,
      creditsUsed: creditCost,
      creditsRemaining: deductResult.newCredits,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('analyze-repercussion error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
