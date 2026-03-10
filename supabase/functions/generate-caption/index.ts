import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';
import { callGemini, extractJSON } from '../_shared/geminiClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function cleanInput(text: string | string[] | undefined | null): string {
  if (!text) return "";
  if (Array.isArray(text)) {
    return text.map(item => String(item || "")).join(", ").replace(/[^\w\sÀ-ÿ,.-]/gi, "").trim();
  }
  return String(text).replace(/[^\w\sÀ-ÿ,.-]/gi, "").replace(/\s+/g, " ").trim();
}

// =====================================
// PLATFORM SPECS
// =====================================
const PLATFORM_SPECS: Record<string, { maxChars: number; recommendedChars: number; hashtagRange: string; tips: string }> = {
  Instagram: {
    maxChars: 2200,
    recommendedChars: 1300,
    hashtagRange: "8-12 hashtags (mix nicho + médio alcance)",
    tips: "Hook impactante nos primeiros 125 chars. Storytelling. Quebras de linha. Máximo 5 emojis. CTA claro (Salve, Compartilhe, Comente).",
  },
  Facebook: {
    maxChars: 63206,
    recommendedChars: 250,
    hashtagRange: "1-3 hashtags",
    tips: "Textos curtos performam melhor. Primeiro parágrafo cativante. Ideal para links diretos.",
  },
  LinkedIn: {
    maxChars: 3000,
    recommendedChars: 1500,
    hashtagRange: "3-5 hashtags profissionais",
    tips: "Textos longos são valorizados. Storytelling profissional. Emojis com moderação (💡🚀✅).",
  },
  TikTok: {
    maxChars: 2200,
    recommendedChars: 150,
    hashtagRange: "3-5 hashtags (tendências + nicho)",
    tips: "SEO crítico: palavras-chave. Tom informal e direto. Incentive engajamento rápido.",
  },
  "Twitter/X": {
    maxChars: 280,
    recommendedChars: 280,
    hashtagRange: "1-2 hashtags",
    tips: "Concisão é fundamental. Perguntas e enquetes. Marque perfis para interação.",
  },
  Comunidades: {
    maxChars: 5000,
    recommendedChars: 800,
    hashtagRange: "2-4 hashtags",
    tips: "Seja autêntico. Perguntas abertas. Entregue valor. CTA sutil.",
  },
};

// =====================================
// FETCH ENRICHMENT DATA
// =====================================
async function fetchBrandContext(supabase: any, brandId: string): Promise<string> {
  if (!brandId) return '';
  const { data } = await supabase
    .from('brands')
    .select('name, segment, values, keywords, goals, promise, restrictions')
    .eq('id', brandId)
    .single();
  if (!data) return '';
  const parts = [`Marca: "${data.name}"`, `Segmento: ${data.segment || 'N/A'}`];
  if (data.values) parts.push(`Valores: ${data.values}`);
  if (data.keywords) parts.push(`Palavras-chave: ${data.keywords}`);
  if (data.goals) parts.push(`Objetivos: ${data.goals}`);
  if (data.promise) parts.push(`Promessa: ${data.promise}`);
  if (data.restrictions) parts.push(`Restrições: ${data.restrictions}`);
  return parts.join(' | ');
}

async function fetchThemeContext(supabase: any, themeId: string): Promise<string> {
  if (!themeId) return '';
  const { data } = await supabase
    .from('strategic_themes')
    .select('title, description, tone_of_voice, target_audience, objectives, macro_themes, hashtags, expected_action')
    .eq('id', themeId)
    .single();
  if (!data) return '';
  const parts = [`Pauta: "${data.title}"`, `Descrição: ${data.description || 'N/A'}`];
  if (data.objectives) parts.push(`Objetivos: ${data.objectives}`);
  if (data.target_audience) parts.push(`Público: ${data.target_audience}`);
  if (data.tone_of_voice) parts.push(`Tom: ${data.tone_of_voice}`);
  if (data.macro_themes) parts.push(`Macro-temas: ${data.macro_themes}`);
  if (data.expected_action) parts.push(`Ação esperada: ${data.expected_action}`);
  if (data.hashtags) parts.push(`Hashtags sugeridas: ${data.hashtags}`);
  return parts.join(' | ');
}

async function fetchPersonaContext(supabase: any, personaId: string): Promise<string> {
  if (!personaId) return '';
  const { data } = await supabase
    .from('personas')
    .select('name, age, gender, location, professional_context, preferred_tone_of_voice, challenges, main_goal, interest_triggers')
    .eq('id', personaId)
    .single();
  if (!data) return '';
  const parts = [`Persona: "${data.name}"`, `${data.age || '?'} anos, ${data.gender || '?'}, ${data.location || '?'}`];
  if (data.professional_context) parts.push(`Contexto: ${data.professional_context}`);
  if (data.challenges) parts.push(`Desafios: ${data.challenges}`);
  if (data.main_goal) parts.push(`Objetivo: ${data.main_goal}`);
  if (data.interest_triggers) parts.push(`Gatilhos: ${data.interest_triggers}`);
  if (data.preferred_tone_of_voice) parts.push(`Tom preferido: ${data.preferred_tone_of_voice}`);
  return parts.join(' | ');
}

// =====================================
// BUILD CAPTION PROMPT
// =====================================
function buildCaptionPrompt(params: {
  platform: string;
  objective: string;
  imageDescription: string;
  toneOfVoice: string;
  contentType: string;
  additionalInfo: string;
  brandContext: string;
  themeContext: string;
  personaContext: string;
  politicalContext: string;
  promptContext: string;
}): string {
  const spec = PLATFORM_SPECS[params.platform] || PLATFORM_SPECS.Instagram;

  return `Você é um Copywriter Político Sênior especializado em redes sociais, com expertise em comunicação política brasileira e marketing digital de alto impacto.

## DADOS DO CONTEÚDO
- **Plataforma:** ${params.platform}
- **Tipo:** ${params.contentType === 'ads' ? 'Anúncio pago' : 'Orgânico'}
- **Objetivo estratégico:** ${params.objective || 'Engajamento'}
- **Descrição visual da imagem:** ${params.imageDescription}
- **Tom de voz solicitado:** ${params.toneOfVoice || 'profissional'}
${params.additionalInfo ? `- **Informações adicionais:** ${params.additionalInfo}` : ''}

## CONTEXTO COMPLETO
${params.brandContext ? `### MARCA\n${params.brandContext}` : ''}
${params.themeContext ? `### PAUTA ESTRATÉGICA\n${params.themeContext}` : ''}
${params.personaContext ? `### PERSONA/PÚBLICO-ALVO\n${params.personaContext}` : ''}
${params.politicalContext ? `### PERFIL POLÍTICO\n${params.politicalContext}` : ''}
${params.promptContext ? `### CONTEXTO DO FORMULÁRIO\n${params.promptContext}` : ''}

## ESPECIFICAÇÕES DA PLATAFORMA (${params.platform})
- Máximo: ${spec.maxChars} caracteres
- Recomendado: ${spec.recommendedChars} caracteres
- Hashtags: ${spec.hashtagRange}
- Dicas: ${spec.tips}

## SUA MISSÃO

Crie uma legenda COMPLETA, PROFISSIONAL e de ALTO IMPACTO seguindo esta estrutura obrigatória:

### 1. TÍTULO (headline)
- Frase magnética de 40-70 caracteres
- Deve despertar curiosidade ou emoção imediata
- Conectar com o objetivo estratégico e a imagem
- Usar linguagem de poder: verbos de ação, números, promessas

### 2. CORPO DA LEGENDA (body)
Estrutura em 4 blocos separados por \\n\\n:

**Bloco 1 - HOOK (1-2 linhas):** Abertura impactante que prende atenção. Pergunta provocativa, estatística surpreendente, ou declaração ousada conectada à imagem.

**Bloco 2 - DESENVOLVIMENTO (2-3 parágrafos):** Storytelling conectando a imagem ao objetivo. Construa narrativa que ressoe com o público-alvo. Incorpore dados da pauta e marca. Linguagem persuasiva e empática.

**Bloco 3 - PROVA/AUTORIDADE (1-2 linhas):** Elemento de credibilidade: dado concreto, realização, compromisso público, ou referência à atuação política.

**Bloco 4 - CTA (1-2 linhas):** Call-to-action forte e claro. Verbo de ação + benefício. Incentive interação (comentário, compartilhamento, salvamento).

### 3. HASHTAGS
- Array com ${spec.hashtagRange}
- Mix estratégico: tema principal + nicho + alcance médio + trending
- Todas relevantes ao conteúdo, marca e pauta
- Em português, sem acentos, minúsculas

## REGRAS DE QUALIDADE
- Máximo 5 emojis em TODA a legenda (use com intenção estratégica)
- Texto rico e descritivo — NUNCA genérico ou raso
- Cada frase deve ter propósito estratégico
- Respeite o tom de voz solicitado: ${params.toneOfVoice || 'profissional'}
- A legenda DEVE complementar a imagem, não apenas descrevê-la
- Compliance TSE 2026: sem pedido de voto, sem deepfakes, sem discriminação

## FORMATO DE RESPOSTA (JSON estrito, sem markdown):
{
  "title": "Título magnético da postagem",
  "body": "Corpo completo da legenda com quebras \\n\\n entre blocos",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6", "hashtag7", "hashtag8"]
}

RETORNE APENAS O JSON.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formData } = await req.json();
    
    console.log("📝 [CAPTION] Dados recebidos:", {
      brand: formData?.brand,
      brandId: formData?.brandId,
      theme: formData?.theme,
      themeId: formData?.themeId,
      platform: formData?.platform,
      objective: formData?.objective,
      imageDescription: formData?.imageDescription,
      tone: formData?.tone,
      persona: formData?.persona,
      personaId: formData?.personaId,
    });
    
    // Authenticate user
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured', fallback: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ [CAPTION] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get profile + political profile + enrichment data in parallel
    const brandId = formData?.brandId || '';
    const themeId = formData?.themeId || '';
    const personaId = formData?.personaId || '';

    const [profileResult, politicalProfile, brandContext, themeContext, personaContext] = await Promise.all([
      supabase.from('profiles').select('team_id, credits').eq('id', user.id).single(),
      fetchPoliticalProfile(supabase, user.id),
      fetchBrandContext(supabase, brandId),
      fetchThemeContext(supabase, themeId),
      fetchPersonaContext(supabase, personaId),
    ]);
    const { data: profile, error: profileError } = profileResult;

    if (profileError) {
      console.error('❌ [CAPTION] Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedTeamId = profile?.team_id || null;

    // Check credits
    const creditCheck = await checkUserCredits(supabase, user.id, CREDIT_COSTS.COMPLETE_IMAGE);
    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.COMPLETE_IMAGE} créditos` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Input validation
    if (!formData || typeof formData !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid form data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!formData.imageDescription || typeof formData.imageDescription !== 'string' || formData.imageDescription.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Image description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validPlatforms = ['Instagram', 'LinkedIn', 'TikTok', 'Twitter/X', 'Facebook', 'Comunidades'];
    const platform = validPlatforms.includes(formData.platform) ? formData.platform : 'Instagram';

    const toneOfVoice = Array.isArray(formData.tone)
      ? formData.tone.map((t: any) => cleanInput(t)).join(", ")
      : cleanInput(formData.tone);

    const politicalContext = buildPoliticalContext(politicalProfile);

    const prompt = buildCaptionPrompt({
      platform,
      objective: cleanInput(formData.objective),
      imageDescription: cleanInput(formData.imageDescription),
      toneOfVoice,
      contentType: formData.contentType || 'organic',
      additionalInfo: cleanInput(formData.additionalInfo),
      brandContext,
      themeContext,
      personaContext,
      politicalContext,
      promptContext: formData.promptContext || '',
    });

    console.log("🔄 [CAPTION] Chamando Gemini API (gemini-2.5-flash)...");

    const result = await callGemini(GEMINI_API_KEY, {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      maxOutputTokens: 2048,
    });

    const content = result.content?.trim();
    console.log("✅ [CAPTION] Gemini response received:", content?.length, "chars");

    if (!content) {
      console.error("❌ [CAPTION] Empty content from Gemini");
      return new Response(
        JSON.stringify({ error: 'Empty response from AI', fallback: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON
    const parsedContent = extractJSON(content);
    if (!parsedContent || !parsedContent.title || !parsedContent.body) {
      console.error("❌ [CAPTION] Invalid JSON from Gemini:", content?.substring(0, 200));
      return new Response(
        JSON.stringify({ error: 'Invalid AI response structure', fallback: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure hashtags is array
    if (!Array.isArray(parsedContent.hashtags)) {
      parsedContent.hashtags = [];
    }

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, user.id, CREDIT_COSTS.COMPLETE_IMAGE);
    if (!deductResult.success) {
      console.error('Error deducting credits:', deductResult.error);
    }

    // Record credit usage
    await recordUserCreditUsage(supabase, {
      userId: user.id,
      teamId: authenticatedTeamId,
      actionType: 'CAPTION_GENERATION',
      creditsUsed: CREDIT_COSTS.COMPLETE_IMAGE,
      creditsBefore: creditCheck.currentCredits,
      creditsAfter: deductResult.newCredits,
      description: 'Geração de legenda',
      metadata: { platform, brand: formData.brand }
    });

    // Save action
    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .insert({
        user_id: user.id,
        team_id: authenticatedTeamId || '00000000-0000-0000-0000-000000000000',
        type: 'CRIAR_CONTEUDO',
        status: 'completed',
        details: { formData, type: 'caption' },
        result: parsedContent
      })
      .select()
      .single();

    if (actionError) {
      console.error('Error saving action:', actionError);
    }

    console.log("✅ [CAPTION] Legenda gerada com sucesso via Gemini");

    return new Response(
      JSON.stringify({
        ...parsedContent,
        actionId: actionData?.id,
        creditsUsed: CREDIT_COSTS.COMPLETE_IMAGE,
        creditsRemaining: deductResult.newCredits
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ [CAPTION] Erro:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: true 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
