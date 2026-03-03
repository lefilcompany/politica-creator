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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = user.id;

    // Fetch profile + political profile
    const [profileResult, politicalProfile] = await Promise.all([
      supabase.from('profiles').select('team_id, credits, name, state, city').eq('id', userId).single(),
      fetchPoliticalProfile(supabase, userId),
    ]);

    const profile = profileResult.data;
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const teamId = profile.team_id;
    const userName = profile.name || 'Usuário';

    // Check credits
    const creditsCheck = await checkUserCredits(supabase, userId, CREDIT_COSTS.GENERATE_TEXT);
    if (!creditsCheck.hasCredits) {
      return new Response(JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.GENERATE_TEXT} créditos` }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const creditsBefore = creditsCheck.currentCredits;

    const { message, brandId, themeId, personaId, platform, tone } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Mensagem deve ter pelo menos 5 caracteres' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch brand/theme/persona in parallel
    const [brandResult, themeResult, personaResult] = await Promise.all([
      brandId ? supabase.from('brands').select('name, segment, values, keywords, promise, restrictions').eq('id', brandId).single() : { data: null },
      themeId ? supabase.from('strategic_themes').select('title, description, tone_of_voice, target_audience, objectives, macro_themes').eq('id', themeId).single() : { data: null },
      personaId ? supabase.from('personas').select('name, age, gender, location, professional_context, challenges, main_goal, beliefs_and_interests, interest_triggers, preferred_tone_of_voice').eq('id', personaId).single() : { data: null },
    ]);

    const brandData = brandResult.data;
    const themeData = themeResult.data;
    const personaData = personaResult.data;
    const politicalContext = buildPoliticalContext(politicalProfile);

    // Build context
    const contextParts: string[] = [];
    const pp = politicalProfile || {} as any;

    if (pp.political_role || profile.state) {
      contextParts.push(`AUTOR: ${userName}, ${pp.political_role || 'Político(a)'} em ${profile.state || 'Brasil'}${pp.political_party ? ` (${pp.political_party})` : ''}`);
    }
    if (pp.mandate_stage) contextParts.push(`Fase: ${pp.mandate_stage}`);
    if (pp.focus_areas?.length) contextParts.push(`Áreas de foco: ${pp.focus_areas.join(', ')}`);
    if (pp.tone_of_voice) contextParts.push(`Tom pessoal: ${pp.tone_of_voice}`);

    if (brandData) {
      contextParts.push(`MARCA: "${brandData.name}" | Segmento: ${brandData.segment || 'N/A'} | Valores: ${brandData.values || 'N/A'} | Promessa: ${brandData.promise || 'N/A'}`);
    }
    if (themeData) {
      contextParts.push(`PAUTA: "${themeData.title}" | Objetivos: ${themeData.objectives || 'N/A'} | Tom: ${themeData.tone_of_voice || 'N/A'} | Audiência: ${themeData.target_audience || 'N/A'}`);
    }
    if (personaData) {
      contextParts.push(`PERSONA-ALVO: "${personaData.name}" | ${personaData.age || '?'} anos, ${personaData.location || '?'} | Desafios: ${personaData.challenges || 'N/A'} | Gatilhos: ${personaData.interest_triggers || 'N/A'}`);
    }

    const toneInstruction = tone ? `O tom deve ser "${tone}".` : '';
    const platformInstruction = platform ? `Otimizado para ${platform}.` : '';

    const systemPrompt = `Você é um Redator Político Sênior e Estrategista de Comunicação. Sua tarefa é transformar a ideia bruta do candidato em 10 versões profissionais de texto para comunicação política.

## DADOS DO CANDIDATO
${contextParts.join('\n')}

${politicalContext ? `## CONTEXTO POLÍTICO\n${politicalContext.substring(0, 1500)}` : ''}

## REGRAS OBRIGATÓRIAS
1. Gere EXATAMENTE 10 versões diferentes do texto
2. Cada versão deve ter um ESTILO DIFERENTE: formal, informal, emotivo, didático, combativo, institucional, narrativo, inspirador, urgente, comunitário
3. Cada texto deve ter entre 50 e 280 caracteres (ideal para redes sociais) a menos que o contexto peça algo maior
4. ${toneInstruction}
5. ${platformInstruction}
6. Respeite TODAS as linhas vermelhas do candidato
7. NÃO inclua hashtags nos textos (serão adicionadas separadamente)
8. O texto deve soar AUTÊNTICO e HUMANO, nunca robótico
9. Adapte a linguagem ao público-alvo e à região do candidato

## COMPLIANCE TSE (Eleições 2026)
- Todo conteúdo deve respeitar a legislação eleitoral vigente
- Proibido conteúdo que induza ao erro ou crie falsas representações
- Proibido discurso de ódio ou violência política
- O conteúdo deve ser identificável como produzido com auxílio de IA

## FORMATO DE RESPOSTA (JSON estrito)
{
  "texts": [
    {
      "id": 1,
      "style": "Nome do estilo",
      "text": "O texto gerado aqui",
      "character_count": 123,
      "best_for": "Onde usar: stories, feed, WhatsApp, etc."
    }
  ]
}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log('📝 Generating 10 text variations...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transforme esta ideia em 10 textos profissionais para comunicação política:\n\n"${message.trim()}"` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos da plataforma esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    let texts: any[] = [];
    try {
      const jsonMatch = content?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        texts = parsed.texts || [];
      }
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      return new Response(JSON.stringify({ error: 'Erro ao processar resposta da IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (texts.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum texto gerado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, userId, CREDIT_COSTS.GENERATE_TEXT);
    const creditsAfter = deductResult.newCredits;

    await recordUserCreditUsage(supabase, {
      userId,
      teamId,
      actionType: 'GENERATE_TEXT',
      creditsUsed: CREDIT_COSTS.GENERATE_TEXT,
      creditsBefore,
      creditsAfter,
      description: 'Geração de texto político (10 variações)',
      metadata: { platform, tone, brandId, themeId, personaId },
    });

    console.log(`✅ Generated ${texts.length} text variations`);

    return new Response(
      JSON.stringify({ texts, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-text:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
