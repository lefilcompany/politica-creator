import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanInput(text: string | string[] | undefined | null): string {
  if (!text) return "";
  if (Array.isArray(text)) {
    return text.map(item => cleanInput(item)).join(", ");
  }
  const textStr = String(text);
  let cleanedText = textStr.replace(/[<>{}[\]"'`]/g, "");
  cleanedText = cleanedText.replace(/\s+/g, " ").trim();
  return cleanedText;
}

// =====================================
// STYLE SETTINGS - Visual Style Mapping
// =====================================
const getStyleSettings = (styleType: string) => {
  const styles: Record<string, { suffix: string; negativePrompt: string }> = {
    realistic: {
      suffix: "high-end portrait photography, hyper-realistic eyes with catchlight, detailed skin pores, fine facial hair, masterpiece, 8k, shot on 85mm lens, f/1.8, cinematic lighting, sharp focus on eyes, natural skin tone, professional studio lighting",
      negativePrompt: "deformed eyes, asymmetrical face, plastic skin, doll-like, cartoon, anime, 3d render, lowres, fused eyes, extra eyelashes, bad anatomy, elongated face, makeup overkill, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, crossed eyes, lazy eye, unnatural skin color"
    },
    animated: {
      suffix: "3D animated character in Pixar/Disney style, expressive features, smooth stylized rendering, vibrant colors, professional 3D animation quality, studio lighting, octane render",
      negativePrompt: "realistic photo, photograph, ugly, deformed, noisy, blurry, low contrast, realism, photorealistic, low quality"
    },
    cartoon: {
      suffix: "cartoon illustration style, bold outlines, flat colors, expressive character design, comic book style, vibrant and playful, clean vector-like illustration",
      negativePrompt: "realistic, photograph, 3d render, dark, scary, blurry, low quality, bad anatomy"
    },
    anime: {
      suffix: "anime art style, Japanese animation aesthetic, detailed eyes, clean lineart, vibrant cel-shading, manga-inspired, studio quality anime illustration",
      negativePrompt: "realistic, photograph, western cartoon, ugly, deformed, blurry, low quality, bad anatomy, extra limbs"
    },
    watercolor: {
      suffix: "watercolor painting style, soft washes of color, visible brush strokes, artistic texture, traditional watercolor on paper effect, delicate and flowing",
      negativePrompt: "digital art, photograph, sharp edges, flat colors, cartoon, anime, low quality"
    },
    oil_painting: {
      suffix: "oil painting style, rich textures, visible brushwork, classical art technique, masterful use of light and shadow, gallery-quality fine art",
      negativePrompt: "digital art, photograph, flat colors, cartoon, anime, low quality, blurry"
    },
    digital_art: {
      suffix: "professional digital art, polished illustration, concept art quality, detailed rendering, vibrant digital painting, artstation quality",
      negativePrompt: "photograph, blurry, low quality, bad anatomy, ugly, deformed"
    },
    sketch: {
      suffix: "pencil sketch style, hand-drawn lines, artistic crosshatching, graphite on paper texture, expressive sketching technique, traditional drawing",
      negativePrompt: "photograph, color, digital, painted, blurry, low quality"
    },
    minimalist: {
      suffix: "minimalist design, clean lines, simple shapes, limited color palette, elegant simplicity, modern aesthetic, white space emphasis",
      negativePrompt: "busy, cluttered, complex, realistic photo, detailed, ornate, low quality"
    },
    vintage: {
      suffix: "vintage retro aesthetic, nostalgic color grading, film grain texture, 70s/80s inspired style, warm tones, analog photography feel",
      negativePrompt: "modern, digital, clean, sharp, contemporary, low quality"
    }
  };
  return styles[styleType] || styles.realistic;
};

// =====================================
// PORTRAIT DETECTION
// =====================================
const isPortraitRequest = (promptText: string): boolean => {
  const portraitKeywords = [
    'retrato', 'portrait', 'rosto', 'face', 'pessoa', 'person', 
    'homem', 'man', 'mulher', 'woman', 'criança', 'child',
    'close-up', 'headshot', 'selfie', 'avatar', 'modelo', 'model',
    'executivo', 'executive', 'profissional', 'professional',
    'jovem', 'young', 'idoso', 'elderly', 'adulto', 'adult'
  ];
  const lowerPrompt = promptText.toLowerCase();
  return portraitKeywords.some(keyword => lowerPrompt.includes(keyword));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user from JWT token
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;

    // Fetch user profile (team_id agora é opcional)
    const [profileResult, politicalProfile] = await Promise.all([
      supabase.from('profiles').select('team_id, credits').eq('id', authenticatedUserId).single(),
      fetchPoliticalProfile(supabase, authenticatedUserId)
    ]);
    const { data: profile, error: profileError } = profileResult;

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao carregar perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // team_id agora é opcional
    const authenticatedTeamId = profile?.team_id || null;

    const formData = await req.json();
    
    // Input validation
    if (!formData.description || typeof formData.description !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Descrição inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generate Image Request:', { 
      description: formData.description?.substring(0, 100),
      brandId: formData.brandId,
      themeId: formData.themeId,
      personaId: formData.personaId,
      platform: formData.platform,
      visualStyle: formData.visualStyle,
      contentType: formData.contentType,
      userId: authenticatedUserId, 
      teamId: authenticatedTeamId,
      preserveImagesCount: formData.preserveImages?.length || 0,
      styleReferenceImagesCount: formData.styleReferenceImages?.length || 0,
    });

    // Check user credits (individual)
    const creditsCheck = await checkUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.COMPLETE_IMAGE);

    if (!creditsCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.COMPLETE_IMAGE} créditos` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creditsBefore = creditsCheck.currentCredits;

    // Build comprehensive structured prompt
    let enhancedPrompt = buildDetailedPrompt(formData);
    const politicalContext = buildPoliticalContext(politicalProfile);
    if (politicalContext) {
      enhancedPrompt += `\n${politicalContext}`;
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Calling Gemini Image Preview API...');

    // Build messages array with reference images
    const messageContent: any[] = [
      { type: 'text', text: enhancedPrompt }
    ];
    
    // Add preserve images first (highest priority - brand images)
    const preserveImages = formData.preserveImages || [];
    if (preserveImages && preserveImages.length > 0) {
      console.log(`✅ Adicionando ${preserveImages.length} imagem(ns) da marca/identidade...`);
      preserveImages.forEach((img: string, index: number) => {
        console.log(`  - Imagem marca ${index + 1}: ${(img.length / 1024).toFixed(0)}KB`);
        messageContent.push({
          type: 'image_url',
          image_url: { url: img }
        });
      });
    }
    
    // Add style reference images after (user uploads)
    const styleReferenceImages = formData.styleReferenceImages || [];
    if (styleReferenceImages && styleReferenceImages.length > 0) {
      console.log(`✅ Adicionando ${styleReferenceImages.length} imagem(ns) de referência do usuário...`);
      styleReferenceImages.forEach((img: string, index: number) => {
        console.log(`  - Imagem usuário ${index + 1}: ${(img.length / 1024).toFixed(0)}KB`);
        messageContent.push({
          type: 'image_url',
          image_url: { url: img }
        });
      });
    }
    
    console.log(`📦 Total de conteúdos na mensagem: ${messageContent.length} (1 texto + ${messageContent.length - 1} imagens)`);

    // Retry logic for image generation
    const MAX_RETRIES = 3;
    let lastError: any = null;
    let imageUrl: string | null = null;
    let description = 'Imagem gerada com sucesso';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Image generation attempt ${attempt}/${MAX_RETRIES}...`);

        // Convert messageContent to Gemini format
        const geminiParts = await Promise.all(messageContent.map(async (item: any) => {
          if (item.type === "text") {
            return { text: item.text };
          } else if (item.type === "image_url") {
            const url = item.image_url.url;
            
            // If it's already base64
            if (url.startsWith('data:')) {
              const base64Data = url.split(',')[1];
              const mimeType = url.match(/data:(.*?);/)?.[1] || 'image/png';
              return { 
                inlineData: { 
                  mimeType, 
                  data: base64Data 
                } 
              };
            }
            
            // If it's a URL, fetch and convert to base64
            try {
              const imageResponse = await fetch(url);
              if (!imageResponse.ok) {
                console.error(`Failed to fetch image from ${url}: ${imageResponse.status}`);
                return null;
              }
              
              const arrayBuffer = await imageResponse.arrayBuffer();
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
              
              // Detect mime type from content-type header or default to png
              const contentType = imageResponse.headers.get('content-type') || 'image/png';
              
              return { 
                inlineData: { 
                  mimeType: contentType, 
                  data: base64Data 
                } 
              };
            } catch (fetchError) {
              console.error(`Error fetching image from ${url}:`, fetchError);
              return null;
            }
          }
          return null;
        })).then(parts => parts.filter(p => p !== null));

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: geminiParts }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"]
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Gemini API error (attempt ${attempt}):`, response.status, errorText);
          
          // Don't retry on rate limit errors
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          lastError = new Error(`Gemini API error: ${response.status}`);
          
          if (attempt < MAX_RETRIES) {
            console.log(`Retrying in 2 seconds... (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          throw lastError;
        }

        const data = await response.json();
        console.log('Gemini API response received');

        // Extract image from response
        if (data.candidates && data.candidates[0]?.content?.parts) {
          const parts = data.candidates[0].content.parts;
          
          for (const part of parts) {
            if (part.inlineData?.data) {
              const base64Image = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/png';
              imageUrl = `data:${mimeType};base64,${base64Image}`;
              console.log('Image extracted successfully from Gemini response');
              break;
            }
          }

          // Extract text description if available
          for (const part of parts) {
            if (part.text) {
              description = part.text;
              break;
            }
          }
        }

        if (!imageUrl) {
          throw new Error('No image found in Gemini response');
        }

        // Success - break retry loop
        break;

      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        lastError = error;
        
        if (attempt < MAX_RETRIES) {
          console.log(`Retrying in 2 seconds... (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!imageUrl) {
      console.error('Failed to generate image after all retries:', lastError);
      return new Response(
        JSON.stringify({ error: 'Falha ao gerar imagem após múltiplas tentativas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload image to Supabase Storage
    console.log('Uploading image to storage...');
    const timestamp = Date.now();
    const fileName = `content-images/${authenticatedTeamId}/${timestamp}.png`;
    
    // Convert base64 to blob
    const base64Data = imageUrl.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content-images')
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao fazer upload da imagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('content-images')
      .getPublicUrl(fileName);

    console.log('Image uploaded successfully:', publicUrl);

    // Deduct user credits (individual)
    const deductResult = await deductUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.COMPLETE_IMAGE);
    const creditsAfter = deductResult.newCredits;

    if (!deductResult.success) {
      console.error('Error deducting credits:', deductResult.error);
    }

    // Record credit usage
    await recordUserCreditUsage(supabase, {
      userId: authenticatedUserId,
      teamId: authenticatedTeamId,
      actionType: 'COMPLETE_IMAGE',
      creditsUsed: CREDIT_COSTS.COMPLETE_IMAGE,
      creditsBefore,
      creditsAfter,
      description: 'Geração de imagem completa',
      metadata: { platform: formData.platform, visualStyle: formData.visualStyle }
    });

    // Save to history (actions table) with storage paths
    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .insert({
        type: 'CRIAR_CONTEUDO',
        user_id: authenticatedUserId,
        team_id: authenticatedTeamId,
        brand_id: formData.brandId || null,
        status: 'Aprovado',
        approved: true,
        asset_path: fileName,
        thumb_path: fileName,
        details: {
          description: formData.description,
          brandId: formData.brandId,
          themeId: formData.themeId,
          personaId: formData.personaId,
          platform: formData.platform,
          visualStyle: formData.visualStyle,
          contentType: formData.contentType,
          preserveImagesCount: formData.preserveImages?.length || 0,
          styleReferenceImagesCount: formData.styleReferenceImages?.length || 0
        },
        result: {
          imageUrl: publicUrl,
          description: description
        }
      })
      .select()
      .single();

    if (actionError) {
      console.error('Error creating action:', actionError);
    }

    return new Response(
      JSON.stringify({ 
        imageUrl: publicUrl,
        description: description,
        actionId: actionData?.id,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-image function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =====================================
// STRUCTURED PROMPT BUILDER
// =====================================
function buildDetailedPrompt(formData: any): string {
  const promptSections: string[] = [];
  
  // Extract and clean all inputs
  const brand = cleanInput(formData.brand);
  const theme = cleanInput(formData.theme);
  const persona = cleanInput(formData.persona);
  const platform = cleanInput(formData.platform);
  const objective = cleanInput(formData.objective);
  const description = cleanInput(formData.description);
  const tones = Array.isArray(formData.tone) ? formData.tone : (formData.tone ? [formData.tone] : []);
  const additionalInfo = cleanInput(formData.additionalInfo);
  const contentType = formData.contentType || 'organic';
  const visualStyle = formData.visualStyle || 'realistic';
  
  // Advanced configurations
  const negativePrompt = cleanInput(formData.negativePrompt);
  const colorPalette = formData.colorPalette || 'auto';
  const lighting = formData.lighting || 'natural';
  const composition = formData.composition || 'auto';
  const cameraAngle = formData.cameraAngle || 'eye_level';
  const detailLevel = formData.detailLevel || 7;
  const mood = formData.mood || 'auto';
  
  // Reference images
  const preserveImages = formData.preserveImages || [];
  const styleReferenceImages = formData.styleReferenceImages || [];

  // =====================================
  // [1] COMPLIANCE - Brazilian Advertising Regulations
  // =====================================
  promptSections.push(`[COMPLIANCE]
DIRETRIZES ÉTICAS E LEGAIS OBRIGATÓRIAS (Código CONAR e CDC - Brasil):
- HONESTIDADE: A imagem NÃO PODE induzir ao erro sobre características do produto/serviço
- DIGNIDADE HUMANA: PROIBIDO qualquer forma de discriminação
- PROTEÇÃO DE VULNERÁVEIS: Se público incluir menores, aplique restrições MÁXIMAS
- BEBIDAS ALCOÓLICAS: NUNCA mostre ou sugira o ato de consumo/ingestão
- ALIMENTOS: NÃO estimule consumo excessivo ou compulsivo
- APOSTAS/JOGOS: OBRIGATÓRIO símbolo 18+ de forma visível
- SUSTENTABILIDADE: Benefícios ambientais devem ser específicos, não vagos
- CONCORRÊNCIA: NÃO ridicularize ou deprecie concorrentes
ESTAS DIRETRIZES SÃO INVIOLÁVEIS.`);

  // =====================================
  // [2] MAIN INSTRUCTION
  // =====================================
  promptSections.push(`[INSTRUCTION]
GERAR NOVA IMAGEM: ${description}`);

  // =====================================
  // [3] BRAND CONTEXT
  // =====================================
  if (brand) {
    promptSections.push(`[BRAND CONTEXT]
MARCA: ${brand}
${theme ? `TEMA ESTRATÉGICO: ${theme}` : ''}
A imagem deve refletir a identidade visual e valores da marca.`);
  }

  // =====================================
  // [4] TARGET AUDIENCE (PERSONA)
  // =====================================
  if (persona) {
    promptSections.push(`[TARGET AUDIENCE]
PERSONA: ${persona}
A imagem deve ressoar emocionalmente e visualmente com este público-alvo específico.`);
  }

  // =====================================
  // [5] PLATFORM OPTIMIZATION
  // =====================================
  if (platform) {
    const platformLabels: Record<string, string> = {
      'Instagram': 'Instagram (visual-first, engagement-focused, mobile-optimized)',
      'Facebook': 'Facebook (broad audience, shareable, community-focused)',
      'TikTok': 'TikTok (dynamic, trendy, youth-oriented)',
      'Twitter/X': 'Twitter/X (concise, newsworthy, conversation-starter)',
      'LinkedIn': 'LinkedIn (professional, business-oriented, thought-leadership)',
      'Comunidades': 'Communities (niche-focused, authentic, value-driven)',
      'instagram_feed': 'Instagram Feed (square format, high visual impact)',
      'instagram_stories': 'Instagram Stories (vertical 9:16, ephemeral, dynamic)',
      'instagram_reels': 'Instagram Reels (vertical 9:16, trendy, engaging)',
      'linkedin_post': 'LinkedIn (professional, business-oriented)',
      'tiktok': 'TikTok (vertical 9:16, trendy, youth-oriented)',
      'facebook_post': 'Facebook (shareable, community-focused)',
      'twitter': 'Twitter/X (concise, newsworthy)',
      'pinterest': 'Pinterest (vertical, aesthetic, inspirational)',
      'youtube_thumbnail': 'YouTube Thumbnail (16:9, attention-grabbing, click-worthy)'
    };
    promptSections.push(`[PLATFORM]
Optimized for ${platformLabels[platform] || platform}`);
  }

  // =====================================
  // [6] CONTENT TYPE
  // =====================================
  if (contentType === 'ads') {
    promptSections.push(`[CONTENT TYPE]
PAID ADVERTISING CONTENT
- Commercial and persuasive focus
- Clear call-to-action implied
- Product/service prominence
- Conversion-oriented composition`);
  } else {
    promptSections.push(`[CONTENT TYPE]
ORGANIC SOCIAL MEDIA CONTENT
- Engagement and connection focus
- Authentic and relatable
- Community-building elements
- Shareable and memorable`);
  }

  // =====================================
  // [7] POST OBJECTIVE
  // =====================================
  if (objective) {
    promptSections.push(`[POST OBJECTIVE]
${objective}`);
  }

  // =====================================
  // [8] TONE OF VOICE
  // =====================================
  if (tones.length > 0) {
    const toneLabels: Record<string, string> = {
      'inspirador': 'inspiring and uplifting',
      'motivacional': 'motivational and encouraging',
      'profissional': 'professional and corporate',
      'casual': 'casual and relaxed',
      'elegante': 'elegant and sophisticated',
      'moderno': 'modern and contemporary',
      'tradicional': 'traditional and classic',
      'divertido': 'fun and playful',
      'sério': 'serious and formal'
    };
    const tonesList = tones.map((t: string) => toneLabels[t] || t).join(', ');
    promptSections.push(`[TONE OF VOICE]
${tonesList}
The visual mood and atmosphere should reflect these tones.`);
  }

  // =====================================
  // [9] ADDITIONAL CONTEXT
  // =====================================
  if (additionalInfo) {
    promptSections.push(`[ADDITIONAL CONTEXT]
${additionalInfo}`);
  }

  // =====================================
  // [10] VISUAL STYLE
  // =====================================
  const styleSettings = getStyleSettings(visualStyle);
  const isPortrait = visualStyle === 'realistic' && isPortraitRequest(description || '');
  
  // For portraits in realistic style, use enhanced portrait settings
  let finalStyleSuffix = styleSettings.suffix;
  if (isPortrait) {
    finalStyleSuffix = "high-end portrait photography, hyper-realistic eyes with catchlight, detailed skin pores, fine facial hair, masterpiece, 8k, shot on 85mm lens, f/1.4, cinematic lighting, sharp focus on eyes, natural skin tone, professional studio lighting, detailed iris, catchlight in eyes";
  }
  
  promptSections.push(`[VISUAL STYLE]
${visualStyle.toUpperCase()}
${finalStyleSuffix}`);

  // =====================================
  // [11] REFERENCE IMAGES INSTRUCTIONS
  // =====================================
  if (preserveImages.length > 0) {
    promptSections.push(`[BRAND IDENTITY IMAGES] (${preserveImages.length} provided)
These are OFFICIAL brand identity images:
- Use EXACTLY the visual style, color palette, and aesthetic from these images
- Maintain the SAME visual quality and finish level
- Replicate design elements (borders, textures, filters, effects)
- Preserve the atmosphere and mood transmitted
- The new image MUST look like part of the same visual set
- If there are logos or specific elements, keep them recognizable`);
  }

  if (styleReferenceImages.length > 0) {
    promptSections.push(`[STYLE REFERENCE IMAGES] (${styleReferenceImages.length} provided)
Use these as additional inspiration:
- Analyze visual elements (colors, layout, objects, atmosphere)
- Adapt these elements coherently
- Use as complement to main brand images
- Not necessary to replicate exactly, just draw inspiration`);
  }

  // =====================================
  // [12] ADVANCED STYLE SETTINGS
  // =====================================
  const advancedSettings: string[] = [];
  
  // Color Palette
  if (colorPalette !== 'auto') {
    const colorPaletteLabels: Record<string, string> = {
      warm: 'Warm palette: orange, red, yellow, and golden tones',
      cool: 'Cool palette: blue, green, purple, and silver tones',
      monochrome: 'Monochromatic palette with variations of a single tone',
      vibrant: 'Vibrant palette with saturated and contrasting colors',
      pastel: 'Soft pastel colors, delicate and subtle',
      earthy: 'Earthy palette with natural brown, green, and beige tones'
    };
    if (colorPaletteLabels[colorPalette]) {
      advancedSettings.push(`Color: ${colorPaletteLabels[colorPalette]}`);
    }
  }
  
  // Lighting
  if (lighting !== 'natural') {
    const lightingLabels: Record<string, string> = {
      studio: 'Professional studio lighting with softboxes, controlled shadows',
      dramatic: 'Dramatic Rembrandt lighting with high contrast, chiaroscuro effect',
      soft: 'Soft diffused lighting with minimal shadows, flattering',
      backlit: 'Backlighting creating rim light and subtle lens flare, halo effect',
      golden_hour: 'Golden hour lighting with warm orange tones, magical atmosphere'
    };
    if (lightingLabels[lighting]) {
      advancedSettings.push(`Lighting: ${lightingLabels[lighting]}`);
    }
  } else {
    advancedSettings.push('Lighting: Natural daylight, soft shadows, balanced exposure');
  }
  
  // Composition
  if (composition !== 'auto') {
    const compositionLabels: Record<string, string> = {
      rule_of_thirds: 'Rule of thirds composition',
      centered: 'Centered and symmetrical composition',
      leading_lines: 'Leading lines guiding the eye',
      frame_within_frame: 'Frame within frame composition',
      symmetrical: 'Symmetrical and balanced composition'
    };
    if (compositionLabels[composition]) {
      advancedSettings.push(`Composition: ${compositionLabels[composition]}`);
    }
  }
  
  // Camera Angle
  if (cameraAngle !== 'eye_level') {
    const cameraLabels: Record<string, string> = {
      bird_eye: 'Bird eye view (aerial, from above)',
      low_angle: 'Low angle looking up (heroic, powerful)',
      dutch_angle: 'Dutch angle (tilted, dynamic)',
      over_shoulder: 'Over the shoulder shot',
      close_up: 'Close-up detailed shot'
    };
    if (cameraLabels[cameraAngle]) {
      advancedSettings.push(`Camera: ${cameraLabels[cameraAngle]}`);
    }
  }
  
  // Mood
  if (mood !== 'auto') {
    const moodLabels: Record<string, string> = {
      energetic: 'Energetic and dynamic atmosphere',
      calm: 'Calm and serene atmosphere',
      mysterious: 'Mysterious and intriguing atmosphere',
      joyful: 'Joyful and festive atmosphere',
      melancholic: 'Melancholic and contemplative atmosphere',
      powerful: 'Powerful and impactful atmosphere'
    };
    if (moodLabels[mood]) {
      advancedSettings.push(`Mood: ${moodLabels[mood]}`);
    }
  }
  
  // Detail Level
  advancedSettings.push(`Detail Level: ${detailLevel}/10`);
  
  if (advancedSettings.length > 0) {
    promptSections.push(`[STYLE SETTINGS]
${advancedSettings.join('\n')}`);
  }

  // =====================================
  // [13] TEXT IN IMAGE
  // =====================================
  const includeText = formData.includeText ?? false;
  const textContent = cleanInput(formData.textContent);
  const textPosition = formData.textPosition || 'center';

  if (!includeText) {
    promptSections.push(`[NO TEXT]
CRITICAL: Do NOT include ANY text, words, letters, numbers, symbols, or written characters visible in the image.
The image must be purely visual, without any overlaid text elements.`);
  } else if (textContent?.trim()) {
    const positionLabels: Record<string, string> = {
      'top': 'at the top of the image',
      'center': 'centered in the image',
      'bottom': 'at the bottom of the image',
      'top-left': 'in the top-left corner',
      'top-right': 'in the top-right corner',
      'bottom-left': 'in the bottom-left corner',
      'bottom-right': 'in the bottom-right corner'
    };
    promptSections.push(`[TEXT OVERLAY]
Include the following text ${positionLabels[textPosition] || 'centered'}: "${textContent}"
The text must be:
- Legible and clearly visible
- With appropriate typography
- With adequate contrast against the background
- In Portuguese (pt-BR), correctly spelled`);
  }

  // =====================================
  // [14] NEGATIVE PROMPT
  // =====================================
  const finalNegativePrompt = [
    styleSettings.negativePrompt,
    negativePrompt
  ].filter(Boolean).join(', ');
  
  promptSections.push(`[AVOID]
${finalNegativePrompt}`);

  return promptSections.join('\n\n');
}
