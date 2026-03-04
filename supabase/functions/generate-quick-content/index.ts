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

    // Fetch user's team from profile (optional now)
    const [profileResult, politicalProfile] = await Promise.all([
      supabase.from('profiles').select('team_id, credits').eq('id', authenticatedUserId).single(),
      fetchPoliticalProfile(supabase, authenticatedUserId)
    ]);
    const { data: profile, error: profileError } = profileResult;

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedTeamId = profile?.team_id || null;

    const body = await req.json();
    
    // Input validation
    if (!body.prompt || typeof body.prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (body.prompt.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Prompt muito longo (máximo 5000 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { 
      prompt, 
      brandId,
      themeId,
      personaId,
      platform,
      referenceImages = [],
      preserveImages = [],
      styleReferenceImages = [],
      aspectRatio = '1:1',
      visualStyle = 'realistic', // NEW: Visual style selection
      style = 'auto',
      quality = 'standard',
      negativePrompt = '',
      colorPalette = 'auto',
      lighting = 'natural',
      composition = 'auto',
      cameraAngle = 'eye_level',
      detailLevel = 7,
      mood = 'auto',
      width = '',
      height = ''
    } = body;

    // Map aspect ratios from platformSpecs to AI model supported ratios
    const validAspectRatios = ['1:1', '4:5', '9:16', '16:9', '3:4'];
    let normalizedAspectRatio = aspectRatio;
    
    // Map common platform aspect ratios to supported ones
    const aspectRatioMap: Record<string, string> = {
      '1.91:1': '16:9',
      '3:4': '4:5',
    };
    
    if (aspectRatioMap[aspectRatio]) {
      normalizedAspectRatio = aspectRatioMap[aspectRatio];
    }
    
    if (!validAspectRatios.includes(normalizedAspectRatio)) {
      console.log(`Invalid aspect ratio ${aspectRatio}, defaulting to 1:1`);
      normalizedAspectRatio = '1:1';
    }

    const hasPreserveImages = preserveImages && preserveImages.length > 0;
    const hasReferenceImages = referenceImages && referenceImages.length > 0;
    const hasStyleReferenceImages = styleReferenceImages && styleReferenceImages.length > 0;

    console.log('Generate Quick Content Request:', { 
      promptLength: prompt.length, 
      brandId,
      platform,
      aspectRatio,
      normalizedAspectRatio,
      visualStyle,
      style,
      hasPreserveImages,
      hasReferenceImages,
      hasStyleReferenceImages,
      userId: authenticatedUserId, 
      teamId: authenticatedTeamId 
    });

    // Check user credits
    const creditCheck = await checkUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.QUICK_IMAGE);

    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.QUICK_IMAGE} créditos` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch brand details if provided
    let brandContext = '';
    let brandName = null;
    if (brandId) {
      const { data: brandData } = await supabase
        .from('brands')
        .select('name, segment, values, keywords, promise, color_palette')
        .eq('id', brandId)
        .single();

      if (brandData) {
        brandName = brandData.name;
        brandContext = `MARCA: ${brandData.name} (${brandData.segment})`;
        if (brandData.values) brandContext += ` | Valores: ${brandData.values}`;
        if (brandData.keywords) brandContext += ` | Keywords: ${brandData.keywords}`;
      }
    }

    // Fetch theme details if provided
    let themeContext = '';
    let themeName = null;
    if (themeId) {
      const { data: themeData } = await supabase
        .from('strategic_themes')
        .select('title, description, tone_of_voice, target_audience, color_palette, objectives')
        .eq('id', themeId)
        .single();

      if (themeData) {
        themeName = themeData.title;
        themeContext = `TEMA: ${themeData.title}`;
        if (themeData.tone_of_voice) themeContext += ` | Tom: ${themeData.tone_of_voice}`;
        if (themeData.target_audience) themeContext += ` | Público: ${themeData.target_audience}`;
        if (themeData.objectives) themeContext += ` | Objetivos: ${themeData.objectives}`;
      }
    }

    // Fetch persona details if provided
    let personaContext = '';
    let personaName = null;
    if (personaId) {
      const { data: personaData } = await supabase
        .from('personas')
        .select('name, age, gender, professional_context, beliefs_and_interests, preferred_tone_of_voice, main_goal')
        .eq('id', personaId)
        .single();

      if (personaData) {
        personaName = personaData.name;
        personaContext = `PERSONA: ${personaData.name} (${personaData.age}, ${personaData.gender})`;
        if (personaData.professional_context) personaContext += ` | Contexto: ${personaData.professional_context}`;
        if (personaData.preferred_tone_of_voice) personaContext += ` | Tom preferido: ${personaData.preferred_tone_of_voice}`;
        if (personaData.main_goal) personaContext += ` | Objetivo: ${personaData.main_goal}`;
      }
    }

    // ========================================
    // VISUAL STYLE SETTINGS
    // ========================================
    // Style-specific prompt configurations for different visual aesthetics
    
    const getStyleSettings = (styleType: string) => {
      const styles: Record<string, { suffix: string; negativePrompt: string }> = {
        realistic: {
          suffix: "high-end portrait photography, hyper-realistic eyes with catchlight, detailed skin pores, fine facial hair, masterpiece, 8k, shot on 85mm lens, f/1.8, cinematic lighting, sharp focus on eyes, natural skin tone, professional studio lighting, raw photo",
          negativePrompt: "cartoon, anime, 3d render, illustration, painting, drawing, deformed eyes, asymmetrical face, plastic skin, doll-like, lowres, fused eyes, extra eyelashes, bad anatomy, elongated face, makeup overkill, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, crossed eyes, lazy eye, unnatural skin color"
        },
        animated: {
          suffix: "3D animated movie style, Pixar Disney animation style, vibrant colors, soft lighting, smooth surfaces, expressive features, highly detailed, cinematic composition, professional 3D render, octane render, unreal engine 5",
          negativePrompt: "realistic, photorealistic, photograph, raw photo, low quality, blurry, pixelated, ugly, deformed, bad anatomy, text, watermark, signature"
        },
        cartoon: {
          suffix: "cartoon style illustration, bold outlines, flat colors, vibrant palette, playful design, clean vector art, comic book style, exaggerated features, expressive, fun aesthetic, professional illustration",
          negativePrompt: "realistic, photorealistic, photograph, 3d render, anime, low quality, blurry, dark, gritty, text, watermark, signature"
        },
        anime: {
          suffix: "anime style, manga illustration, Japanese animation aesthetic, cel shading, vibrant colors, detailed eyes, soft lighting, studio ghibli inspired, beautiful lineart, high quality anime art, detailed background",
          negativePrompt: "realistic, photorealistic, photograph, western cartoon, 3d render, low quality, blurry, bad anatomy, extra limbs, text, watermark, signature"
        },
        watercolor: {
          suffix: "watercolor painting, soft washes, delicate brushstrokes, paper texture, artistic, flowing colors, ethereal atmosphere, hand-painted aesthetic, traditional art, fine art painting, gallery quality",
          negativePrompt: "photograph, digital art, 3d render, sharp edges, hard lines, low quality, blurry, text, watermark, signature"
        },
        oil_painting: {
          suffix: "oil painting masterpiece, rich impasto texture, classical painting technique, museum quality, fine art, dramatic lighting, old masters style, canvas texture, brushstroke details, gallery piece, renaissance inspired",
          negativePrompt: "photograph, digital art, 3d render, cartoon, anime, flat colors, low quality, blurry, text, watermark, signature"
        },
        digital_art: {
          suffix: "digital art illustration, concept art, artstation trending, highly detailed, vibrant colors, dynamic composition, professional digital painting, matte painting, fantasy art style, epic scene",
          negativePrompt: "photograph, low quality, blurry, amateur, bad anatomy, deformed, text, watermark, signature"
        },
        sketch: {
          suffix: "pencil sketch, hand-drawn illustration, artistic sketch, cross-hatching, graphite drawing, professional artist sketch, detailed linework, sketchbook style, raw artistic expression, traditional drawing",
          negativePrompt: "color, photograph, 3d render, digital art, low quality, blurry, text, watermark, signature"
        },
        minimalist: {
          suffix: "minimalist design, clean lines, simple composition, negative space, modern aesthetic, elegant simplicity, geometric shapes, limited color palette, sophisticated design, scandinavian style",
          negativePrompt: "cluttered, busy, complex, detailed, realistic, photograph, low quality, blurry, text, watermark, signature"
        },
        vintage: {
          suffix: "vintage aesthetic, retro style, nostalgic atmosphere, film grain, faded colors, 70s 80s inspired, analog photography feel, warm tones, old-school charm, classic look, polaroid style",
          negativePrompt: "modern, futuristic, digital, clean, sharp, cartoon, anime, low quality, blurry, text, watermark, signature"
        }
      };
      
      return styles[styleType] || styles.realistic;
    };
    
    const styleSettings = getStyleSettings(visualStyle);
    console.log('Visual style applied:', visualStyle);
    
    // Detect if this is a portrait/face request (only for realistic style)
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

    // Only apply portrait-specific settings for realistic style
    const isPortrait = visualStyle === 'realistic' && isPortraitRequest(prompt);
    console.log('Portrait detection:', { isPortrait, visualStyle, prompt: prompt.substring(0, 100) });
    
    // Use style-specific settings
    let promptSuffix = styleSettings.suffix;
    let negativePromptBase = styleSettings.negativePrompt;
    
    // Resolution mapping based on aspect ratio
    const getResolutionFromAspectRatio = (ratio: string, isPortraitMode: boolean) => {
      if (isPortraitMode && ratio === '1:1') {
        return { width: 1024, height: 1024, type: 'close_up' };
      }
      switch(ratio) {
        case '9:16':
        case '4:5':
        case '3:4':
          return { width: 832, height: 1216, type: 'portrait' };
        case '16:9':
          return { width: 1216, height: 832, type: 'widescreen' };
        case '1:1':
        default:
          return { width: 1024, height: 1024, type: 'square' };
      }
    };
    
    const resolution = getResolutionFromAspectRatio(normalizedAspectRatio, isPortrait);
    console.log('Target resolution:', resolution, 'isPortrait:', isPortrait);
    
    // ========================================
    // BUILD COMPREHENSIVE PROMPT
    // ========================================
    // Construct a detailed prompt incorporating all user inputs
    
    // Add political context
    const politicalContext = buildPoliticalContext(politicalProfile);
    
    // Start with the main instruction
    let userPrompt = `GENERATE NEW IMAGE: ${prompt}`;
    if (politicalContext) {
      contextSections.push(`[POLITICAL PROFILE] ${politicalContext}`);
    }
    
    // Add context sections
    const contextSections: string[] = [];
    
    // Brand context
    if (brandContext) {
      contextSections.push(`[BRAND CONTEXT] ${brandContext}`);
    }
    
    // Theme context
    if (themeContext) {
      contextSections.push(`[THEME CONTEXT] ${themeContext}`);
    }
    
    // Persona context
    if (personaContext) {
      contextSections.push(`[TARGET AUDIENCE] ${personaContext}`);
    }
    
    // Platform context
    if (platform) {
      const platformLabels: Record<string, string> = {
        'instagram_feed': 'Instagram Feed (square format, bold visuals)',
        'instagram_stories': 'Instagram Stories (vertical format, engaging)',
        'instagram_reels': 'Instagram Reels (vertical video format)',
        'facebook_feed': 'Facebook Feed (versatile format)',
        'linkedin_post': 'LinkedIn (professional, business-oriented)',
        'tiktok': 'TikTok (vertical, trendy, dynamic)',
        'youtube_thumbnail': 'YouTube Thumbnail (eye-catching, bold text)',
        'twitter': 'Twitter/X (horizontal, concise)',
        'pinterest': 'Pinterest (vertical, aesthetic, inspirational)',
        'whatsapp_status': 'WhatsApp Status (vertical, personal)'
      };
      const platformLabel = platformLabels[platform] || platform;
      contextSections.push(`[PLATFORM] Optimized for ${platformLabel}`);
    }
    
    // Visual style
    contextSections.push(`[VISUAL STYLE] ${visualStyle.toUpperCase()} - ${promptSuffix}`);
    
    // Advanced options section
    const advancedOptions: string[] = [];
    
    // Color palette
    if (colorPalette && colorPalette !== 'auto') {
      const paletteLabels: Record<string, string> = {
        'vibrant': 'vibrant and saturated colors',
        'pastel': 'soft pastel tones',
        'monochrome': 'monochromatic color scheme',
        'warm': 'warm color palette (reds, oranges, yellows)',
        'cool': 'cool color palette (blues, greens, purples)',
        'earthy': 'earthy natural tones',
        'neon': 'neon and electric colors',
        'muted': 'muted and desaturated tones'
      };
      advancedOptions.push(`Color: ${paletteLabels[colorPalette] || colorPalette}`);
    }
    
    // Lighting
    if (lighting && lighting !== 'natural') {
      const lightingLabels: Record<string, string> = {
        'natural': 'natural daylight',
        'studio': 'professional studio lighting',
        'dramatic': 'dramatic high-contrast lighting',
        'soft': 'soft diffused lighting',
        'golden_hour': 'golden hour warm lighting',
        'blue_hour': 'blue hour cool lighting',
        'backlit': 'backlit silhouette effect',
        'neon': 'neon/artificial colored lighting',
        'low_key': 'low-key dark moody lighting',
        'high_key': 'high-key bright even lighting'
      };
      advancedOptions.push(`Lighting: ${lightingLabels[lighting] || lighting}`);
    }
    
    // Composition
    if (composition && composition !== 'auto') {
      const compositionLabels: Record<string, string> = {
        'rule_of_thirds': 'rule of thirds composition',
        'centered': 'centered symmetrical composition',
        'diagonal': 'dynamic diagonal composition',
        'minimalist': 'minimalist clean composition',
        'layered': 'layered depth composition',
        'symmetrical': 'symmetrical balanced composition',
        'asymmetrical': 'asymmetrical dynamic composition',
        'framing': 'natural framing composition'
      };
      advancedOptions.push(`Composition: ${compositionLabels[composition] || composition}`);
    }
    
    // Camera angle
    if (cameraAngle && cameraAngle !== 'eye_level') {
      const angleLabels: Record<string, string> = {
        'eye_level': 'eye level straight angle',
        'low_angle': 'low angle looking up (powerful)',
        'high_angle': 'high angle looking down (overview)',
        'dutch_angle': 'dutch/tilted angle (dynamic)',
        'birds_eye': 'birds eye top-down view',
        'worms_eye': 'worms eye extreme low angle',
        'close_up': 'close-up detail shot',
        'wide_shot': 'wide establishing shot'
      };
      advancedOptions.push(`Camera: ${angleLabels[cameraAngle] || cameraAngle}`);
    }
    
    // Mood
    if (mood && mood !== 'auto') {
      const moodLabels: Record<string, string> = {
        'professional': 'professional and polished',
        'playful': 'playful and fun',
        'elegant': 'elegant and sophisticated',
        'bold': 'bold and impactful',
        'serene': 'serene and peaceful',
        'energetic': 'energetic and dynamic',
        'mysterious': 'mysterious and intriguing',
        'romantic': 'romantic and dreamy',
        'nostalgic': 'nostalgic and vintage feel',
        'futuristic': 'futuristic and modern'
      };
      advancedOptions.push(`Mood: ${moodLabels[mood] || mood}`);
    }
    
    // Detail level
    if (detailLevel && detailLevel !== 7) {
      const detailDesc = detailLevel <= 3 ? 'simplified minimal details' 
        : detailLevel <= 5 ? 'moderate level of detail'
        : detailLevel <= 7 ? 'high level of detail'
        : 'ultra-high intricate details';
      advancedOptions.push(`Detail: ${detailDesc}`);
    }
    
    // Add advanced options to prompt
    if (advancedOptions.length > 0) {
      contextSections.push(`[STYLE SETTINGS] ${advancedOptions.join(', ')}`);
    }
    
    // Reference images instructions
    if (hasPreserveImages) {
      contextSections.push(`[REFERENCE IMAGES] Preserve the main elements, faces, and subjects from the attached images. Maintain their appearance while applying the requested style.`);
    } else if (hasStyleReferenceImages) {
      contextSections.push(`[STYLE REFERENCE] Use the visual style, color palette, and atmosphere from the attached images as reference.`);
    } else if (hasReferenceImages) {
      contextSections.push(`[INSPIRATION] Draw inspiration from the attached images to create the new image.`);
    }
    
    // Combine everything
    if (contextSections.length > 0) {
      userPrompt += '\n\n' + contextSections.join('\n');
    }
    
    // Add negative prompt
    let negativePromptFinal = negativePromptBase;
    if (negativePrompt && negativePrompt.trim()) {
      negativePromptFinal = `${negativePrompt.trim()}, ${negativePromptBase}`;
    }
    userPrompt += `\n\n[AVOID] ${negativePromptFinal}`;
    
    console.log('=== FULL PROMPT ===');
    console.log(userPrompt);
    console.log('===================');
    console.log('Prompt length:', userPrompt.length, 'chars');

    // Prepare reference images for the API
    const imageInputs: any[] = [];
    
    // Add preserve images first (highest priority)
    if (hasPreserveImages) {
      for (const img of preserveImages) {
        if (img) {
          const isBase64 = typeof img === 'string' && (img.startsWith('data:') || !img.startsWith('http'));
          if (isBase64) {
            const base64Data = img.startsWith('data:') ? img.split(',')[1] : img;
            imageInputs.push({
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            });
          }
        }
      }
    }

    // Add reference images
    if (hasReferenceImages) {
      for (const img of referenceImages) {
        if (img) {
          const isBase64 = typeof img === 'string' && (img.startsWith('data:') || !img.startsWith('http'));
          if (isBase64) {
            const base64Data = img.startsWith('data:') ? img.split(',')[1] : img;
            imageInputs.push({
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            });
          }
        }
      }
    }

    // Add style reference images
    if (hasStyleReferenceImages) {
      for (const img of styleReferenceImages) {
        if (img) {
          const isBase64 = typeof img === 'string' && (img.startsWith('data:') || !img.startsWith('http'));
          if (isBase64) {
            const base64Data = img.startsWith('data:') ? img.split(',')[1] : img;
            imageInputs.push({
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            });
          }
        }
      }
    }

    console.log('Reference images prepared:', imageInputs.length);

    // Call Gemini API with improved settings
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não configurada.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the request body with images if available
    const requestParts: any[] = [{ text: userPrompt }];
    
    // Add all image inputs
    for (const imageInput of imageInputs) {
      requestParts.push(imageInput);
    }

    console.log('Calling Gemini API with', requestParts.length, 'parts (including', imageInputs.length, 'images)');

    // Use improved model with high quality settings
    // Aspect ratio is controlled via prompt context
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: requestParts
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      
      if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (geminiResponse.status === 400) {
        // Check if it's a content policy violation
        if (errorText.includes('SAFETY') || errorText.includes('policy')) {
          return new Response(
            JSON.stringify({ 
              error: 'O conteúdo solicitado viola as políticas de uso. Tente um prompt diferente.',
              isComplianceError: true
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: 'Erro na requisição. Verifique o prompt e tente novamente.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    // Extract image from response
    let imageUrl = null;
    let textResponse = null;

    if (geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content) {
      const parts = geminiData.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        }
        if (part.text) {
          textResponse = part.text;
        }
      }
    }

    if (!imageUrl) {
      console.error('No image in Gemini response:', JSON.stringify(geminiData).substring(0, 500));
      
      // Check if the model returned a text explanation (policy violation)
      if (textResponse) {
        console.log('Model text response:', textResponse);
        return new Response(
          JSON.stringify({ 
            error: 'O modelo não conseguiu gerar a imagem. O conteúdo solicitado pode violar as políticas de uso. Tente um prompt diferente.',
            isComplianceError: true,
            modelResponse: textResponse
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Não foi possível gerar a imagem. Tente novamente com um prompt diferente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Image generated successfully');

    // Deduct credits after successful generation
    const deductResult = await deductUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.QUICK_IMAGE);
    
    if (!deductResult.success) {
      console.error('Error deducting credits:', deductResult.error);
    }

    // Record credit usage
    await recordUserCreditUsage(supabase, {
      userId: authenticatedUserId,
      teamId: authenticatedTeamId,
      actionType: 'QUICK_IMAGE',
      creditsUsed: CREDIT_COSTS.QUICK_IMAGE,
      creditsBefore: creditCheck.currentCredits,
      creditsAfter: deductResult.newCredits,
      description: 'Criação rápida de imagem',
      metadata: { platform, aspectRatio: normalizedAspectRatio, style, brandId }
    });

    // Save action to database
    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .insert({
        user_id: authenticatedUserId,
        team_id: authenticatedTeamId || '00000000-0000-0000-0000-000000000000',
        type: 'CRIAR_CONTEUDO_RAPIDO',
        status: 'completed',
        brand_id: brandId || null,
        details: {
          prompt,
          platform,
          aspectRatio: normalizedAspectRatio,
          style,
          quality,
          colorPalette,
          lighting,
          composition,
          cameraAngle,
          detailLevel,
          mood,
          negativePrompt: negativePrompt ? true : false,
          hasReferenceImages,
          hasPreserveImages,
          hasStyleReferenceImages,
          themeId,
          personaId
        },
        result: {
          imageUrl,
          textResponse,
          generatedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (actionError) {
      console.error('Error saving action:', actionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl,
        textResponse,
        actionId: actionData?.id,
        creditsUsed: CREDIT_COSTS.QUICK_IMAGE,
        creditsRemaining: deductResult.newCredits,
        brandName,
        themeName,
        personaName,
        platform
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-quick-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
