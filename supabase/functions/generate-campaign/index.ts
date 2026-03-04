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
    const { brandId, themeId, personaId, objective, platform, description, politicalTone, additionalInfo } = body;

    // Check credits
    const creditCost = CREDIT_COSTS.CAMPAIGN_PACKAGE;
    const creditCheck = await checkUserCredits(supabase, user.id, creditCost);
    if (!creditCheck.hasCredits) {
      return new Response(JSON.stringify({
        error: 'Créditos insuficientes',
        required: creditCost,
        available: creditCheck.currentCredits,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch all context data in parallel
    const [brandData, themeData, personaData, politicalProfile] = await Promise.all([
      brandId ? supabase.from('brands').select('*').eq('id', brandId).single().then(r => r.data) : null,
      themeId ? supabase.from('strategic_themes').select('*').eq('id', themeId).single().then(r => r.data) : null,
      personaId ? supabase.from('personas').select('*').eq('id', personaId).single().then(r => r.data) : null,
      fetchPoliticalProfile(supabase, user.id),
    ]);

    const politicalContext = buildPoliticalContext(politicalProfile);

    // Build context string
    const contextParts: string[] = [];
    if (brandData) contextParts.push(`IDENTIDADE: "${brandData.name}" | Segmento: ${brandData.segment} | Valores: ${brandData.values || 'N/A'} | Promessa: ${brandData.promise || 'N/A'}`);
    if (themeData) contextParts.push(`PAUTA ESTRATÉGICA: "${themeData.title}" | Objetivos: ${themeData.objectives} | Macro-temas: ${themeData.macro_themes} | Tom: ${themeData.tone_of_voice} | Audiência: ${themeData.target_audience}`);
    if (personaData) contextParts.push(`AUDIÊNCIA: "${personaData.name}" | ${personaData.age}, ${personaData.gender}, ${personaData.location} | Desafios: ${personaData.challenges} | Objetivo: ${personaData.main_goal} | Gatilhos: ${personaData.interest_triggers}`);
    if (politicalProfile) {
      const pp = politicalProfile;
      const polParts: string[] = [];
      if (pp.political_role) polParts.push(`Cargo: ${pp.political_role}`);
      if (pp.political_party) polParts.push(`Partido: ${pp.political_party}`);
      if (pp.political_level) polParts.push(`Nível: ${pp.political_level}`);
      if (pp.mandate_stage) polParts.push(`Fase: ${pp.mandate_stage}`);
      if (pp.focus_areas?.length) polParts.push(`Foco: ${pp.focus_areas.join(', ')}`);
      if (polParts.length) contextParts.push(`PERFIL POLÍTICO: ${polParts.join(' | ')}`);
    }

    // Gemini API key is checked by geminiClient.ts

    const systemPrompt = `Você é um Estrategista de Marketing Político Sênior e Diretor de Campanha experiente. 
Sua missão é gerar um PACOTE COMPLETO DE CAMPANHA com base nos dados do formulário.

## DADOS DO FORMULÁRIO:
${contextParts.join('\n')}

${politicalContext ? `## CONTEXTO POLÍTICO:\n${politicalContext.substring(0, 1500)}` : ''}

Tom político selecionado: ${politicalTone || 'institucional'}
Plataforma: ${platform || 'Instagram'}
Objetivo: ${objective || 'engajamento'}
Descrição/Pauta: ${description || 'N/A'}
${additionalInfo ? `Informações adicionais: ${additionalInfo}` : ''}

## SUA MISSÃO — Gerar o pacote completo:

### 1. MICRO-NARRATIVAS (10 unidades)
Cada uma com ângulo diferente: dor local, solução concreta, história real, dado estatístico, compromisso público, convite à ação, prestação de contas, conquista, denúncia legítima, visão de futuro.
Para cada micro-narrativa, forneça:
- "titulo": headline impactante (máx 10 palavras)
- "texto": corpo da narrativa (80-150 palavras), pronto para postar
- "angulo": qual ângulo foi usado
- "briefing_visual": descrição visual detalhada para gerar uma imagem (50-80 palavras, descrevendo cena, cores, iluminação, composição)
- "hashtags": 3-5 hashtags relevantes

### 2. PROPOSTAS DE AÇÃO (2 unidades)
Cada uma com:
- "titulo": nome da proposta
- "descricao": o que é a proposta (100-200 palavras)
- "como_executar": passo a passo prático
- "custo_politico": análise do custo político (baixo/médio/alto + justificativa)
- "dependencias": o que precisa acontecer antes
- "impacto_esperado": resultado previsto

### 3. DISCURSOS PARA EVENTOS (2 unidades)
Cada um com:
- "tipo_evento": ex: inauguração, plenária, debate, comício
- "titulo": título do discurso
- "texto_completo": discurso completo (300-500 palavras)
- "notas_orador": dicas de tom, pausas, gestos

### 4. ANÚNCIOS (3 unidades)
Formatos: vídeo curto (15-30s), carrossel (3-5 slides), banner/CTA
Cada um com:
- "formato": "video_curto" | "carrossel" | "banner_cta"
- "titulo": headline principal
- "roteiro": script ou conteúdo dos slides
- "cta": call-to-action
- "briefing_visual": descrição visual para criação

## REGRAS:
- Todo conteúdo em português brasileiro
- Respeitar linhas vermelhas do perfil político
- Adequar ao tom selecionado (${politicalTone})
- Conteúdo factual, ético e alinhado com legislação eleitoral (TSE)
- Nunca inventar dados ou estatísticas — use referências genéricas se não houver dados reais
- Cada peça deve ser autocontida e pronta para uso`;

    console.log('🎯 Generating campaign package...');
    
    const { callGemini, toOpenAIFormat } = await import('../_shared/geminiClient.ts');

    const geminiResult = await callGemini({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Gere o pacote completo de campanha. Responda APENAS com JSON válido no formato:
{
  "micro_narrativas": [...],
  "propostas_acao": [...],
  "discursos": [...],
  "anuncios": [...]
}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_campaign_package",
          description: "Gera um pacote completo de campanha política",
          parameters: {
            type: "object",
            properties: {
              micro_narrativas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string" },
                    texto: { type: "string" },
                    angulo: { type: "string" },
                    briefing_visual: { type: "string" },
                    hashtags: { type: "array", items: { type: "string" } }
                  },
                  required: ["titulo", "texto", "angulo", "briefing_visual", "hashtags"]
                }
              },
              propostas_acao: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string" },
                    descricao: { type: "string" },
                    como_executar: { type: "string" },
                    custo_politico: { type: "string" },
                    dependencias: { type: "string" },
                    impacto_esperado: { type: "string" }
                  },
                  required: ["titulo", "descricao", "como_executar", "custo_politico", "dependencias", "impacto_esperado"]
                }
              },
              discursos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tipo_evento: { type: "string" },
                    titulo: { type: "string" },
                    texto_completo: { type: "string" },
                    notas_orador: { type: "string" }
                  },
                  required: ["tipo_evento", "titulo", "texto_completo", "notas_orador"]
                }
              },
              anuncios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    formato: { type: "string" },
                    titulo: { type: "string" },
                    roteiro: { type: "string" },
                    cta: { type: "string" },
                    briefing_visual: { type: "string" }
                  },
                  required: ["formato", "titulo", "roteiro", "cta", "briefing_visual"]
                }
              }
            },
            required: ["micro_narrativas", "propostas_acao", "discursos", "anuncios"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "generate_campaign_package" } },
    });

    if (!geminiResult.ok) {
      console.error(`Gemini error: ${geminiResult.status}`);
      if (geminiResult.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Gemini API error: ${geminiResult.status}`);
    }

    const aiData = toOpenAIFormat(geminiResult);
    
    // Extract from tool call response
    let campaignPackage;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      campaignPackage = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      // Fallback: try parsing from content
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        campaignPackage = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse campaign package from AI response');
      }
    }

    console.log('✅ Campaign package generated:', {
      narrativas: campaignPackage.micro_narrativas?.length || 0,
      propostas: campaignPackage.propostas_acao?.length || 0,
      discursos: campaignPackage.discursos?.length || 0,
      anuncios: campaignPackage.anuncios?.length || 0,
    });

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
      actionType: 'CAMPAIGN_PACKAGE',
      creditsUsed: creditCost,
      creditsBefore: creditCheck.currentCredits,
      creditsAfter: deductResult.newCredits,
      description: `Pacote de campanha: ${brandData?.name || 'N/A'} - ${themeData?.title || 'N/A'}`,
    });

    // Save action record
    await supabase.from('actions').insert({
      user_id: user.id,
      team_id: creditCheck.teamId,
      type: 'CRIAR_CAMPANHA',
      brand_id: brandId || null,
      status: 'Concluído',
      details: { objective, platform, description, politicalTone, additionalInfo, brandId, themeId, personaId },
      result: campaignPackage,
    });

    return new Response(JSON.stringify({
      success: true,
      package: campaignPackage,
      creditsUsed: creditCost,
      creditsRemaining: deductResult.newCredits,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-campaign error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
