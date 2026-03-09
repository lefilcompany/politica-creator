import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function cleanInput(text: string | string[] | undefined | null): string {
  if (!text) return "";
  
  if (Array.isArray(text)) {
    return text
      .map(item => String(item || ""))
      .join(", ")
      .replace(/[^\w\sÀ-ÿ,.-]/gi, "")
      .trim();
  }
  
  return String(text)
    .replace(/[^\w\sÀ-ÿ,.-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCaptionPrompt(formData: any): string {
  const brandName = cleanInput(formData.brand);
  const themeName = cleanInput(formData.theme);
  const platform = cleanInput(formData.platform);
  const objective = cleanInput(formData.objective);
  const imageDescription = cleanInput(formData.imageDescription);
  const audience = cleanInput(formData.audience);
  const toneOfVoice = Array.isArray(formData.tone) 
    ? formData.tone.map((t: any) => cleanInput(t)).join(", ")
    : cleanInput(formData.tone);
  const personaDescription = cleanInput(formData.persona);
  const additionalInfo = cleanInput(formData.additionalInfo);

  // Validar campos obrigatórios (marca é opcional)
  if (!platform || !objective || !imageDescription) {
    throw new Error("Campos obrigatórios faltando: plataforma, objetivo e descrição da imagem");
  }

  // Mapear tipo de conteúdo (orgânico vs anúncios)
  const contentType = cleanInput(formData.contentType) || "organic";
  
  const platformInstructions: Record<string, any> = {
    Instagram: {
      organic: {
        maxChars: 2200,
        recommendedChars: 1300,
        hookChars: 125,
        hashtags: { min: 5, max: 15, strategy: "Mix de nicho + médio alcance + populares" },
        tips: [
          "Hook inicial impactante nos primeiros 125 caracteres",
          "Use storytelling para engajar",
          "Quebras de linha entre parágrafos principais",
          "Máximo 5 emojis em toda a legenda",
          "Inclua CTA claro (Salve, Compartilhe, Comente)"
        ]
      },
      ads: {
        maxChars: 2200,
        recommendedChars: 150,
        tips: [
          "Mensagem direta e clara sobre a oferta",
          "Primeiras 3 linhas são críticas",
          "Use botão de CTA nativo (Saiba Mais, Comprar Agora)",
          "Evite texto excessivo na imagem"
        ]
      }
    },
    Facebook: {
      organic: {
        maxChars: 63206,
        recommendedChars: 250,
        hashtags: { min: 1, max: 3, strategy: "Hashtags menos importantes, foque em texto" },
        tips: [
          "Textos curtos (até 250 caracteres) performam melhor",
          "Use quebras de linha e emojis para facilitar leitura",
          "Ideal para compartilhar links diretos",
          "Primeiro parágrafo deve ser cativante"
        ]
      },
      ads: {
        maxChars: 125,
        recommendedChars: 125,
        tips: [
          "Título entre 25-40 caracteres",
          "Texto principal até 125 caracteres para evitar cortes",
          "Descrição do link com ~30 caracteres",
          "Teste diferentes combinações de imagem e texto"
        ]
      }
    },
    LinkedIn: {
      organic: {
        maxChars: 3000,
        recommendedChars: 1500,
        hashtags: { min: 3, max: 5, strategy: "Hashtags profissionais e de nicho" },
        tips: [
          "Textos longos e elaborados são valorizados",
          "Conte histórias profissionais e compartilhe aprendizados",
          "Use quebras de linha para criar 'respiros'",
          "Emojis profissionais com moderação (💡, 🚀, ✅)"
        ]
      },
      ads: {
        maxChars: 600,
        recommendedChars: 150,
        tips: [
          "Texto introdutório até 150 caracteres recomendado",
          "Título do anúncio: 70 caracteres para melhor visualização",
          "Use CTAs pré-definidos (Saiba mais, Inscreva-se)"
        ]
      }
    },
    TikTok: {
      organic: {
        maxChars: 2200,
        recommendedChars: 150,
        hashtags: { min: 3, max: 5, strategy: "Tendências + nicho + específico" },
        tips: [
          "SEO é CRÍTICO: use palavras-chave que descrevam o vídeo",
          "Hashtags essenciais para alcance",
          "Tom informal e direto",
          "Incentive engajamento rápido (Ex: Você sabia disso? Comenta aí!)"
        ]
      },
      ads: {
        maxChars: 100,
        recommendedChars: 100,
        tips: [
          "Limite de 100 caracteres",
          "Comunicação principal deve estar no vídeo",
          "Legenda como apoio pequeno",
          "Pareça conteúdo nativo, não anúncio"
        ]
      }
    },
    "Twitter/X": {
      organic: {
        maxChars: 280,
        recommendedChars: 280,
        hashtags: { min: 1, max: 2, strategy: "1-2 hashtags para conversas relevantes" },
        tips: [
          "Concisão é fundamental",
          "Vá direto ao ponto",
          "Faça perguntas e crie enquetes",
          "Marque outros perfis (@) para gerar interação"
        ]
      },
      ads: {
        maxChars: 280,
        tips: [
          "Tweet: 280 caracteres",
          "Título do Card: 70 caracteres (cortado após 50)",
          "Descrição: 200 caracteres (não aparece em todos os lugares)"
        ]
      }
    },
    Comunidades: {
      organic: {
        maxChars: 5000,
        tips: [
          "Seja autêntico - fale como um membro, não como marca",
          "Faça perguntas abertas para gerar conversa",
          "Entregue valor primeiro sem pedir nada em troca",
          "Respeite as regras sobre autopromoção",
          "CTA sutil: 'O que vocês acham?', 'Alguém já passou por isso?'"
        ]
      }
    }
  };

  const platformData = platformInstructions[platform]?.[contentType] || platformInstructions[platform]?.organic || platformInstructions.Instagram.organic;
  
  let specificInstructions = `\n## Para ${platform} (${contentType === 'organic' ? 'Orgânico' : 'Anúncio'}):\n`;
  specificInstructions += `### Especificações de Legenda:\n`;
  
  if (platformData.maxChars) {
    specificInstructions += `- Limite máximo: ${platformData.maxChars} caracteres\n`;
  }
  if (platformData.recommendedChars) {
    specificInstructions += `- Recomendado: ${platformData.recommendedChars} caracteres\n`;
  }
  if (platformData.hookChars) {
    specificInstructions += `- Hook inicial: ${platformData.hookChars} caracteres (antes do "ver mais")\n`;
  }
  if (platformData.hashtags) {
    specificInstructions += `- Hashtags: ${platformData.hashtags.min}-${platformData.hashtags.max} (${platformData.hashtags.strategy})\n`;
  }
  if (platformData.tips) {
    specificInstructions += `\n### Dicas Importantes:\n`;
    platformData.tips.forEach((tip: string) => {
      specificInstructions += `- ${tip}\n`;
    });
  }

  return `
# CONTEXTO ESTRATÉGICO
- **Marca/Empresa**: ${brandName}
- **Tema Central**: ${themeName || "Não especificado"}
- **Plataforma de Publicação**: ${platform}
- **Objetivo Estratégico**: ${objective}
- **Descrição Visual da Imagem**: ${imageDescription}
- **Público-Alvo**: ${audience || "Não especificado"}
- **Persona Específica**: ${personaDescription || "Não especificada"}
- **Tom de Voz/Comunicação**: ${toneOfVoice || "Não especificado"}
- **Informações Complementares**: ${additionalInfo || "Não informado"}

# SUA MISSÃO COMO COPYWRITER ESPECIALISTA
Você é um copywriter especialista em redes sociais com mais de 10 anos de experiência criando conteúdos virais e de alto engajamento. Sua tarefa é criar uma legenda COMPLETA e ENVOLVENTE para a descrição da ${platform}, seguindo as melhores práticas de marketing digital, storytelling e copywriting.

# ESTRUTURA IDEAL DA LEGENDA (SIGA RIGOROSAMENTE)

## ABERTURA IMPACTANTE (1-2 linhas)
- Hook que desperta curiosidade ou emoção
- Pode ser uma pergunta, declaração ousada, ou estatística impressionante
- Deve conectar diretamente com a imagem

## DESENVOLVIMENTO (2-4 parágrafos)
- Conte uma história relacionada à imagem
- Conecte com o objetivo e a persona
- Use quebras de linha para facilitar leitura
- Incorpore gatilhos emocionais

## CALL-TO-ACTION PODEROSO (1-2 linhas)
- Comando claro e específico
- Use verbos de ação: "Descubra", "Experimente", "Transforme", "Acesse"
- Inclua senso de urgência quando apropriado

## PRINCÍPIOS DE USO DE EMOJIS (CRÍTICO)
- MÁXIMO 3-5 emojis em TODA a legenda
- Use emojis apenas em momentos estratégicos
- NUNCA use emojis em todos os parágrafos
- Priorize SEMPRE texto rico sobre ícones visuais

# DIRETRIZES DE LINGUAGEM E ESTILO
${specificInstructions}

# REQUISITOS OBRIGATÓRIOS
- A legenda DEVE estar PERFEITAMENTE ALINHADA com a descrição da imagem: "${imageDescription}"
- MANTENHA coerência total com a identidade da marca ${brandName}
${themeName ? `- REFLITA o tema estratégico "${themeName}" de forma clara e natural` : ''}
${personaDescription ? `- ESCREVA diretamente para a persona definida: ${personaDescription}` : ''}
${audience ? `- FALE diretamente com o público: ${audience}` : ''}
${toneOfVoice ? `- MANTENHA o tom de voz: ${toneOfVoice}` : ''}
- Use linguagem de copywriter profissional, persuasiva e impactante
- Incorpore gatilhos emocionais e elementos que incentivem interação
- Inclua pelo menos 1 pergunta para engajamento
- Termine com CTA forte e claro

# REGRAS TÉCNICAS DE SAÍDA (CRÍTICAS)
- Resposta EXCLUSIVAMENTE em JSON válido
- ZERO texto adicional, explicações ou markdown
- Estrutura EXATA: {"title", "body", "hashtags"}

## ESPECIFICAÇÕES:
- **"title"**: Título magnético de 45-60 caracteres que funcione como headline
- **"body"**: Legenda completa de 900-1300 caracteres, com TEXTO ABUNDANTE e emojis minimalistas (máximo 5 emojis no total)
- **"hashtags"**: Array com 8-10 hashtags estratégicas (MIX de nicho + médio alcance)

## FORMATAÇÃO DA LEGENDA:
- Use '\\n\\n' para separar parágrafos principais
- Use '\\n' apenas para subtítulos ou quebras estratégicas
- MÁXIMO 5 EMOJIS EM TODA A LEGENDA (incluso título)
- Priorize parágrafos de texto corrido e descritivo
- Evite listas com bullets ou excesso de quebras
- Mantenha-se dentro do limite de caracteres da plataforma

**FORMATO DE RESPOSTA (JSON VÁLIDO):**
{
  "title": "Título/gancho da postagem",
  "body": "Corpo completo da legenda com quebras de linha apropriadas",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}

RETORNE APENAS O JSON, SEM TEXTO ADICIONAL ANTES OU DEPOIS.
  `.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formData } = await req.json();
    
    console.log("📝 [CAPTION] Dados recebidos:", {
      brand: formData?.brand,
      theme: formData?.theme,
      platform: formData?.platform,
      objective: formData?.objective,
      imageDescription: formData?.imageDescription,
      tone: formData?.tone,
      persona: formData?.persona,
      audience: formData?.audience
    });
    
    // Authenticate user
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get user's profile (team_id is optional now)
    const [profileResult, politicalProfile] = await Promise.all([
      supabase.from('profiles').select('team_id, credits').eq('id', user.id).single(),
      fetchPoliticalProfile(supabase, user.id)
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

    // Check user credits (individual)
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
    
    if (formData.imageDescription.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Description too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const validPlatforms = ['Instagram', 'LinkedIn', 'TikTok', 'Twitter', 'Facebook'];
    if (formData.platform && !validPlatforms.includes(formData.platform)) {
      return new Response(
        JSON.stringify({ error: 'Invalid platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured', fallback: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const politicalContext = buildPoliticalContext(politicalProfile);
    const prompt = buildCaptionPrompt(formData) + politicalContext;

    console.log("🔄 Chamando OpenAI API...");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    console.log(`📡 OpenAI Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [CAPTION] Erro OpenAI:", {
        status: response.status,
        error: errorText
      });
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'OpenAI rate limit exceeded. Try again in a moment.',
            fallback: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid OpenAI API key',
            fallback: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API error',
          fallback: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log("✅ OpenAI Response received");
    const content = data.choices?.[0]?.message?.content;

    console.log("🤖 [CAPTION] Resposta da AI recebida:", {
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 100)
    });

    if (!content) {
      console.error("❌ [CAPTION] Conteúdo vazio retornado pela AI");
      throw new Error("Empty content returned");
    }

    // Parse JSON response
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error("❌ [CAPTION] Erro ao fazer parse do JSON:", parseError);
      throw new Error("Invalid JSON response from AI");
    }

    // Validate response structure
    if (!parsedContent.title || !parsedContent.body || !Array.isArray(parsedContent.hashtags)) {
      console.error("❌ [CAPTION] Estrutura de resposta inválida:", parsedContent);
      throw new Error("Invalid response structure from AI");
    }

    // Deduct credits after successful generation (individual)
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
      metadata: { platform: formData.platform, brand: formData.brand }
    });

    // Save action to database
    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .insert({
        user_id: user.id,
        team_id: authenticatedTeamId || '00000000-0000-0000-0000-000000000000',
        type: 'CRIAR_CONTEUDO',
        status: 'completed',
        details: {
          formData,
          type: 'caption'
        },
        result: parsedContent
      })
      .select()
      .single();

    if (actionError) {
      console.error('Error saving action:', actionError);
    }

    console.log("✅ [CAPTION] Legenda gerada com sucesso");

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
