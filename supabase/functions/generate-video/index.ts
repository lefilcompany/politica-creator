import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para processar vídeo em background
async function processVideoGeneration(operationName: string, actionId: string, userId: string, teamId: string | null) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let isDone = false;
    let videoUri = null;
    let attempts = 0;
    const maxAttempts = 60; // 10 minutos (60 tentativas x 5 segundos)

    console.log('Background: Starting video processing for operation:', operationName);

    while (!isDone && attempts < maxAttempts) {
      attempts++;
      console.log(`Background: Polling attempt ${attempts}/${maxAttempts}...`);
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Verificar a cada 5 segundos
      
      const statusResponse = await fetch(
        `${BASE_URL}/${operationName}`,
        {
          headers: {
            'x-goog-api-key': GEMINI_API_KEY!,
          },
        }
      );

      if (!statusResponse.ok) {
        console.error('Background: Status check failed:', statusResponse.status);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log('Background: Full status data:', JSON.stringify(statusData, null, 2));
      isDone = statusData.done === true;

      // Verificar se a operação falhou
      if (statusData.error || statusData.response?.error) {
        const errorMsg = statusData.error?.message || JSON.stringify(statusData.response?.error);
        console.error('Background: Operation failed with error:', errorMsg);
        throw new Error(`Video generation failed: ${errorMsg}`);
      }

      // Verificar se operação foi cancelada
      if (statusData.metadata?.verb === 'cancel') {
        throw new Error('Video generation was cancelled');
      }

      if (isDone) {
        console.log('Background: ✅ Operation completed!');
        console.log('Background: Full response structure:', JSON.stringify(statusData.response, null, 2));
        
        // Verificar se o conteúdo foi filtrado pelo RAI (segurança)
        const raiReasons = statusData.response?.generateVideoResponse?.raiMediaFilteredReasons;
        const raiCount = statusData.response?.generateVideoResponse?.raiMediaFilteredCount;
        if (raiReasons && raiReasons.length > 0) {
          console.error('Background: Content filtered by RAI:', raiReasons);
          throw new Error(`Conteúdo bloqueado pela política de segurança da IA: ${raiReasons[0]}`);
        }
        if (raiCount && raiCount > 0 && !statusData.response?.generateVideoResponse?.generatedSamples?.length) {
          console.error('Background: All samples filtered by RAI, count:', raiCount);
          throw new Error('Todos os vídeos gerados foram bloqueados pela política de segurança. Tente reformular o prompt sem mencionar nomes de pessoas reais ou celebridades.');
        }
        
        // Tentar múltiplos caminhos possíveis na resposta
        videoUri = statusData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                   statusData.response?.video?.uri ||
                   statusData.response?.generatedSamples?.[0]?.video?.uri ||
                   statusData.response?.result?.video?.uri;
        
        // Se ainda não encontrou, verificar se há erro na resposta
        if (!videoUri && statusData.response?.error) {
          console.error('Background: API returned error:', statusData.response.error);
          throw new Error(`API error: ${JSON.stringify(statusData.response.error)}`);
        }
        
        console.log('Background: Video URI found:', videoUri);
      }
    }

    if (!videoUri) {
      throw new Error(`Video URI not found in response after ${attempts} attempts (${attempts * 5} seconds)`);
    }

    // Download do vídeo
    console.log('Background: Downloading video from:', videoUri);
    const videoResponse = await fetch(videoUri, {
      headers: {
        'x-goog-api-key': GEMINI_API_KEY!,
      },
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    console.log('Background: Video downloaded, size:', videoBlob.size, 'bytes');
    
    // Para vídeos grandes, armazenar em storage ao invés de base64
    const fileName = `${actionId}_${Date.now()}.mp4`;
    const filePath = `videos/${fileName}`;
    
    // Upload para storage bucket
    const arrayBuffer = await videoBlob.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('videos')
      .upload(filePath, arrayBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      console.error('Background: Error uploading video to storage:', uploadError);
      throw uploadError;
    }

    // Obter URL pública do vídeo
    const { data: publicUrlData } = supabase
      .storage
      .from('videos')
      .getPublicUrl(filePath);
    
    const videoUrl = publicUrlData.publicUrl;
    console.log('Background: Video uploaded to storage:', videoUrl);

    // Atualizar histórico com status de conclusão
    await supabase
      .from('credit_history')
      .update({
        metadata: { 
          action_id: actionId, 
          operation_name: operationName,
          status: 'completed',
          processing_time: `${attempts * 5} seconds`
        }
      })
      .eq('user_id', userId)
      .eq('action_type', 'VIDEO_GENERATION')
      .eq('metadata->>action_id', actionId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Atualizar o action no banco com a URL do vídeo
    const { error: updateError } = await supabase
      .from('actions')
      .update({
        result: { 
          videoUrl,
          processingTime: `${attempts * 5} seconds`,
          attempts: attempts,
          // Metadata do modelo usado
          modelUsed: operationName.includes('veo-3.1') ? 'veo-3.1' : 'veo-3.0',
          audioStyle: Deno.env.get('VIDEO_AUDIO_STYLE') || 'sound_effects',
          visualStyle: Deno.env.get('VIDEO_VISUAL_STYLE') || 'cinematic'
        },
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', actionId);

    if (updateError) {
      console.error('Background: Error updating action:', updateError);
      throw updateError;
    }

    console.log('Background: Video generation completed successfully');
  } catch (error) {
    console.error('Background: Error processing video:', error);
    
    // Atualizar o action com erro
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase
      .from('actions')
      .update({
        status: 'failed',
        result: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error instanceof Error ? error.stack : undefined,
          failedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', actionId);
    
    // Atualizar histórico com status de falha
    await supabase
      .from('credit_history')
      .update({
        metadata: { 
          action_id: actionId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      .eq('user_id', userId)
      .eq('action_type', 'VIDEO_GENERATION')
      .eq('metadata->>action_id', actionId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    // NOTA: Créditos NÃO são devolvidos em caso de falha,
    // pois o processamento já foi iniciado e consumiu recursos da API
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não configurada. Configure a chave da API do Gemini.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      prompt, 
      generationType = 'image_to_video',
      preserveImages = [],
      styleReferenceImages = [],
      actionId,
      includeText = false,
      textContent = "",
      textPosition = "center",
      // PARÂMETROS VEO 3.1
      audioStyle = 'sound_effects',
      visualStyle = 'cinematic',
      aspectRatio = '9:16',
      resolution = '1080p',
      duration = 8,
      negativePrompt = '',
      // MODELO DE VÍDEO
      videoModel = 'veo'
    } = await req.json();

    const sanitizePromptForVideoSafety = (rawPrompt: string): string => {
      if (!rawPrompt) return rawPrompt;

      let sanitized = rawPrompt;

      // Remove "Marca: ..." blocks
      sanitized = sanitized.replace(/(?:^|\s)Marca:\s*[^.!\n]+[.!]?/gi, ' ');

      // Remove political titles followed by proper names
      sanitized = sanitized.replace(
        /\b(Vereador|Vereadora|Deputado|Deputada|Prefeito|Prefeita|Senador|Senadora|Governador|Governadora|Ministro|Ministra|Presidente|Candidato|Candidata)\s+[A-ZÀ-Ú][A-Za-zÀ-ÿ'-]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ú][A-Za-zÀ-ÿ'-]+){0,4}/gi,
        '$1'
      );

      // Remove standalone proper names (2+ consecutive capitalized words that look like person names)
      // Common Portuguese non-name words to keep
      const keepWords = new Set(['Criar', 'Vídeo', 'Conteúdo', 'Brasil', 'São', 'Rio', 'Minas', 'Gerais', 'Paulo', 'Janeiro', 'Grande', 'Norte', 'Sul', 'Bahia', 'Ceará', 'Pará', 'Santa', 'Catarina', 'Paraná', 'Goiás', 'Maranhão', 'Porto', 'Alegre', 'Belo', 'Horizonte', 'Recife', 'Fortaleza', 'Salvador', 'Brasília', 'Curitiba', 'Instagram', 'Facebook', 'Twitter', 'TikTok', 'YouTube', 'LinkedIn', 'WhatsApp', 'Stories', 'Reels', 'Feed', 'Post', 'Story']);
      
      sanitized = sanitized.replace(
        /\b([A-ZÀ-Ú][a-zà-ÿ]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ú][a-zà-ÿ]+){1,4})\b/g,
        (match, group) => {
          const words = group.split(/\s+/).filter((w: string) => !w.match(/^d[aeo]s?$/i));
          const allKept = words.every((w: string) => keepWords.has(w));
          if (allKept) return match;
          // If it looks like a person name (not in keep list), remove it
          const nonKeptCount = words.filter((w: string) => !keepWords.has(w)).length;
          if (nonKeptCount >= 2) return '';
          return match;
        }
      );

      return sanitized.replace(/\s+/g, ' ').trim() || rawPrompt;
    };

    const safePrompt = sanitizePromptForVideoSafety(prompt);

    console.log('🎬 Iniciando geração de vídeo com Gemini Veo');
    console.log('🎯 Tipo de geração:', generationType);
    console.log('📝 Prompt sanitizado:', safePrompt);
    console.log('🆔 Action ID:', actionId);
    console.log('📝 Incluir texto:', includeText);
    console.log('📝 Conteúdo do texto:', textContent ? `"${textContent}"` : 'Nenhum');
    console.log('📍 Posição do texto:', textPosition);
    console.log('🔊 Áudio:', audioStyle);
    console.log('🎨 Estilo Visual:', visualStyle);
    console.log('📐 Proporção:', aspectRatio);
    console.log('🎞️ Resolução:', resolution);
    console.log('⏱️ Duração:', duration + 's');
    console.log('🖼️ Imagens preservadas:', preserveImages?.length || 0);
    console.log('🎨 Imagens de estilo:', styleReferenceImages?.length || 0);

    // Validar imagens de referência se for image_to_video
    if (generationType === 'image_to_video' && (!preserveImages || preserveImages.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Pelo menos uma imagem é necessária para geração image-to-video (Veo 3.0)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!actionId) {
      return new Response(
        JSON.stringify({ error: 'actionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar team_id, user_id e details do action
    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .select('team_id, user_id, details')
      .eq('id', actionId)
      .single();

    if (actionError || !actionData) {
      console.error('Error fetching action:', actionError);
      return new Response(
        JSON.stringify({ error: 'Action not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados completos para enriquecer o prompt
    let brandData = null;
    let themeData = null;
    let personaData = null;

    const { brand_id, theme_id, persona_id } = actionData.details || {};

    if (brand_id) {
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brand_id)
        .maybeSingle();
      brandData = brand;
    }

    if (theme_id) {
      const { data: theme } = await supabase
        .from('strategic_themes')
        .select('*')
        .eq('id', theme_id)
        .maybeSingle();
      themeData = theme;
    }

    if (persona_id) {
      const { data: persona } = await supabase
        .from('personas')
        .select('*')
        .eq('id', persona_id)
        .maybeSingle();
      personaData = persona;
    }

    console.log('📊 Dados contextuais carregados:', {
      brand: brandData?.name || 'N/A',
      theme: themeData?.title || 'N/A',
      persona: personaData?.name || 'N/A'
    });

    // Verificar créditos do usuário individual (não mais team)
    const creditCheck = await checkUserCredits(supabase, actionData.user_id, CREDIT_COSTS.VIDEO_GENERATION);

    if (!creditCheck.hasCredits) {
      console.log(`Insufficient credits for video generation. Required: ${CREDIT_COSTS.VIDEO_GENERATION}, Available: ${creditCheck.currentCredits}`);
      
      // Atualizar action como failed
      await supabase
        .from('actions')
        .update({
          status: 'failed',
          result: { 
            error: 'Créditos insuficientes para gerar vídeo',
            required: CREDIT_COSTS.VIDEO_GENERATION,
            available: creditCheck.currentCredits
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', actionId);

      return new Response(
        JSON.stringify({ 
          error: 'Créditos insuficientes', 
          required: CREDIT_COSTS.VIDEO_GENERATION,
          available: creditCheck.currentCredits,
          message: `São necessários ${CREDIT_COSTS.VIDEO_GENERATION} créditos. Você tem ${creditCheck.currentCredits}.`
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Credits available:', creditCheck.currentCredits);
    
    // Decrementar créditos IMEDIATAMENTE antes de iniciar processamento
    console.log('Decrementing credits before starting video generation...');

    const creditsBefore = creditCheck.currentCredits;
    const deductResult = await deductUserCredits(supabase, actionData.user_id, CREDIT_COSTS.VIDEO_GENERATION);

    if (!deductResult.success) {
      console.error('Error decrementing credits:', deductResult.error);
      return new Response(
        JSON.stringify({ error: 'Erro ao decrementar créditos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar no histórico IMEDIATAMENTE
    await recordUserCreditUsage(supabase, {
      userId: actionData.user_id,
      teamId: actionData.team_id || undefined,
      actionType: 'VIDEO_GENERATION',
      creditsUsed: CREDIT_COSTS.VIDEO_GENERATION,
      creditsBefore: creditsBefore,
      creditsAfter: deductResult.newCredits,
      description: 'Geração de vídeo iniciada',
      metadata: { 
        action_id: actionId, 
        generation_type: generationType,
        status: 'processing_started'
      }
    });

    console.log(`Credits decremented: ${creditsBefore} → ${deductResult.newCredits}`);

    console.log('🤖 Modelo selecionado pelo usuário:', videoModel);

    // ========== SORA 2 (OpenAI) ==========
    if (videoModel === 'sora') {
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'OPENAI_API_KEY não configurada para Sora 2.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mapear aspect ratio para resolução Sora
      const soraResolution = aspectRatio === '9:16' ? '720x1280' : '1280x720';
      
      console.log('🎬 [Sora 2] Iniciando geração de vídeo');
      console.log('📝 [Sora 2] Prompt:', safePrompt);
      console.log('📐 [Sora 2] Resolução:', soraResolution);
      console.log('⏱️ [Sora 2] Duração:', duration + 's');

      // 1. Criar job de vídeo
      const createResponse = await fetch('https://api.openai.com/v1/videos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sora-2',
          prompt: safePrompt,
          seconds: String(Math.min(duration, 20)),
          size: soraResolution,
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('❌ [Sora 2] Create error:', createResponse.status, errorText);
        
        // Reembolsar para erros de servidor/quota
        if (createResponse.status === 429 || createResponse.status >= 500) {
          const { data: currentProfile } = await supabase.from('profiles').select('credits').eq('id', actionData.user_id).single();
          if (currentProfile) {
            const refundedAfter = currentProfile.credits + CREDIT_COSTS.VIDEO_GENERATION;
            await supabase.from('profiles').update({ credits: refundedAfter }).eq('id', actionData.user_id);
            await recordUserCreditUsage(supabase, {
              userId: actionData.user_id, teamId: actionData.team_id || undefined,
              actionType: 'VIDEO_GENERATION_REFUND', creditsUsed: -CREDIT_COSTS.VIDEO_GENERATION,
              creditsBefore: currentProfile.credits, creditsAfter: refundedAfter,
              description: `Reembolso: Erro ${createResponse.status} no Sora 2`,
              metadata: { action_id: actionId, error_status: createResponse.status }
            });
          }
        }

        await supabase.from('actions').update({
          status: 'failed',
          result: { error: `Erro Sora 2: ${createResponse.status}`, details: errorText },
          updated_at: new Date().toISOString()
        }).eq('id', actionId);

        return new Response(
          JSON.stringify({ error: 'Erro ao iniciar geração com Sora 2', status: 'failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const jobData = await createResponse.json();
      const videoJobId = jobData.id;
      console.log('✅ [Sora 2] Job criado:', videoJobId);

      // 2. Background polling do Sora
      const soraBackgroundPromise = (async () => {
        try {
          let isDone = false;
          let attempts = 0;
          const maxAttempts = 120; // 10 min

          while (!isDone && attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 5000));

            const statusRes = await fetch(`https://api.openai.com/v1/videos/${videoJobId}`, {
              headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            });

            if (!statusRes.ok) {
              console.error('[Sora 2] Status check failed:', statusRes.status);
              const statusText = await statusRes.text();
              console.error('[Sora 2] Status body:', statusText);
              continue;
            }

            const statusData = await statusRes.json();
            console.log(`[Sora 2] Poll ${attempts}: status=${statusData.status}`);

            if (statusData.status === 'completed') {
              isDone = true;

              // 3. Download do MP4
              const contentRes = await fetch(`https://api.openai.com/v1/videos/${videoJobId}/content`, {
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
              });

              if (!contentRes.ok) {
                throw new Error(`Sora 2 download failed: ${contentRes.status}`);
              }

              const videoBlob = await contentRes.blob();
              console.log('[Sora 2] Video downloaded, size:', videoBlob.size);

              // Upload para storage
              const fileName = `${actionId}_sora_${Date.now()}.mp4`;
              const filePath = `videos/${fileName}`;
              const arrayBuffer = await videoBlob.arrayBuffer();

              const { error: uploadError } = await supabase.storage
                .from('videos')
                .upload(filePath, arrayBuffer, { contentType: 'video/mp4', upsert: true });

              if (uploadError) throw uploadError;

              const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(filePath);
              const videoUrl = publicUrlData.publicUrl;

              await supabase.from('actions').update({
                result: {
                  videoUrl,
                  processingTime: `${attempts * 5} seconds`,
                  attempts,
                  modelUsed: 'sora-2',
                  veoVersion: 'sora-2',
                },
                status: 'completed',
                updated_at: new Date().toISOString()
              }).eq('id', actionId);

              console.log('✅ [Sora 2] Video generation completed');

            } else if (statusData.status === 'failed') {
              const errorMsg = statusData.error?.message || 'Sora 2 generation failed';
              throw new Error(errorMsg);
            }
          }

          if (!isDone) {
            throw new Error('Sora 2 timeout after 10 minutes');
          }
        } catch (error) {
          console.error('[Sora 2] Background error:', error);
          await supabase.from('actions').update({
            status: 'failed',
            result: {
              error: error instanceof Error ? error.message : 'Unknown error',
              modelUsed: 'sora-2',
              failedAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          }).eq('id', actionId);
        }
      })();

      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(soraBackgroundPromise);
      } else {
        soraBackgroundPromise;
      }

      return new Response(
        JSON.stringify({
          status: 'processing',
          message: 'Sora 2 video generation started.',
          actionId,
          modelUsed: 'sora-2'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== VEO (Google) ==========
    const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    // Nova função para Veo 3.0 (Image-to-Video) - Imperativa e Focada
    function buildVeo30Prompt(
      basePrompt: string,
      preserveIdentity: boolean,
      negativePrompt: string
    ): string {
      let prompt = '';
      
      if (preserveIdentity) {
        prompt = `[CRITICAL - IDENTITY PRESERVATION MODE]

EXACT VISUAL REPLICATION:
- COPY EXACTLY: colors, textures, objects, clothing, and backgrounds from the provided image
- MAINTAIN PRECISELY: scene composition, lighting quality, and camera framing
- DO NOT ALTER: color schemes, visual elements, or design aesthetic

ALLOWED CHANGES:
- Add subtle motion/animation to existing elements
- Create depth and dimension through movement
- Animate existing objects (do not add new ones)

${basePrompt}

FORBIDDEN:
- Changing colors, styles, or visual identity
- Adding new objects, people, or elements not in the original image
- Altering the artistic style or visual aesthetic`;
      } else {
        prompt = `ANIMATION BASED ON REFERENCE IMAGE:

Use the provided image as the starting point and animate it following these instructions:

${basePrompt}

STYLE: Maintain the general aesthetic of the reference image while adding dynamic movement.`;
      }
      
      if (negativePrompt?.trim()) {
        prompt += `\n\nEXCLUDE FROM VIDEO:\n${negativePrompt}`;
      }
      
      return prompt;
    }

    // Nova função para Veo 3.1 (Text-to-Video) - Estruturada com Pesos
    function buildVeo31Prompt(
      userPrompt: string,
      brandData: any,
      themeData: any,
      personaData: any,
      visualStyle: string,
      hasPreserveImages: boolean,
      hasStyleImages: boolean,
      includeText: boolean,
      textContent: string,
      textPosition: string,
      negativePrompt: string
    ): string {
      let prompt = '';
      
      // 1. COMANDO PRINCIPAL (maior peso)
      prompt = `[PRIMARY DIRECTIVE]\n${userPrompt}\n\n`;
      
      // 2. IDENTIDADE VISUAL (se aplicável)
      if (hasPreserveImages) {
        prompt += `[CRITICAL - VISUAL IDENTITY PRESERVATION]\n`;
        prompt += `The reference image(s) provided DEFINE the visual identity.\n`;
        prompt += `MANDATORY REQUIREMENTS:\n`;
        prompt += `- USE EXACT colors, textures, and design elements from these images\n`;
        prompt += `- REPLICATE the artistic style, composition, and aesthetic completely\n`;
        prompt += `- MAINTAIN visual consistency as if part of the same brand/campaign\n`;
        prompt += `- DO NOT deviate from the established visual language\n\n`;
      }
      
      // 3. ESTILO DE REFERÊNCIA (menor prioridade)
      if (hasStyleImages) {
        prompt += `[STYLE INSPIRATION - Secondary Reference]\n`;
        prompt += `Draw composition and mood inspiration from style reference image(s).\n`;
        prompt += `Adapt ideas while maintaining primary visual identity.\n\n`;
      }
      
      // 4. CONTEXTO DE MARCA (conciso e direto)
      if (brandData) {
        prompt += `[BRAND CONTEXT]\n`;
        if (brandData.keywords) prompt += `Visual Style: ${brandData.keywords}\n`;
        if (brandData.values) prompt += `Brand Values: ${brandData.values}\n`;
        prompt += `\n`;
      }
      
      // 5. TEMA ESTRATÉGICO (apenas o essencial)
      if (themeData) {
        prompt += `[CAMPAIGN THEME]\n`;
        prompt += `${themeData.title}${themeData.objectives ? `: ${themeData.objectives}` : ''}\n`;
        if (themeData.toneOfVoice) prompt += `Tone: ${themeData.toneOfVoice}\n`;
        prompt += `\n`;
      }
      
      // 6. PÚBLICO-ALVO (apenas dados relevantes)
      if (personaData) {
        prompt += `[TARGET AUDIENCE]\n`;
        prompt += `${personaData.name} - ${personaData.age}, ${personaData.location}\n`;
        if (personaData.main_goal) prompt += `Goal: ${personaData.main_goal}\n`;
        prompt += `\n`;
      }
      
      // 7. ESTILO VISUAL (imperativo)
      const styleMap: Record<string, string> = {
        cinematic: `[VISUAL STYLE: CINEMATIC]\nHollywood-quality production: professional camera work, cinematic lighting, shallow depth of field, film grain, dramatic composition, proper color grading.`,
        animation: `[VISUAL STYLE: ANIMATION]\nAnimated aesthetics: vibrant colors, stylized motion, cartoon/anime-inspired, exaggerated expressions, playful energy.`,
        realistic: `[VISUAL STYLE: REALISTIC]\nPhotorealistic rendering: natural lighting, accurate physics, real textures, authentic colors, documentary-style.`,
        creative: `[VISUAL STYLE: CREATIVE]\nArtistic experimentation: unique effects, creative transitions, bold colors, innovative cinematography.`
      };
      prompt += `${styleMap[visualStyle] || styleMap.cinematic}\n\n`;
      
      // 8. TEXTO (se aplicável)
      if (includeText && textContent?.trim()) {
        const positionMap: Record<string, string> = {
          'top': 'TOP of frame',
          'center': 'CENTER of frame',
          'bottom': 'BOTTOM of frame',
          'top-left': 'TOP-LEFT corner',
          'top-right': 'TOP-RIGHT corner',
          'bottom-left': 'BOTTOM-LEFT corner',
          'bottom-right': 'BOTTOM-RIGHT corner'
        };
        prompt += `[TEXT OVERLAY - MANDATORY]\n`;
        prompt += `Display "${textContent}" at ${positionMap[textPosition] || 'center'}.\n`;
        prompt += `Text must be: clearly visible, high contrast, readable throughout video.\n\n`;
      } else {
        prompt += `[NO TEXT]\nThis video must be completely text-free. No words, letters, captions, or written characters.\n\n`;
      }
      
      // 9. EXCLUSÕES (prompt negativo)
      if (negativePrompt?.trim()) {
        prompt += `[FORBIDDEN ELEMENTS]\n${negativePrompt}\n`;
      }
      
      return prompt;
    }
    
    // Construir prompt otimizado baseado no tipo de geração
    let optimizedPrompt = '';
    
    if (generationType === 'image_to_video') {
      // Veo 3.0: Prompt focado em movimento com preservação exata
      const preserveIdentity = preserveImages && preserveImages.length > 0;
      optimizedPrompt = buildVeo30Prompt(safePrompt, preserveIdentity, negativePrompt);
      console.log('🎬 Using Veo 3.0 optimized prompt (Image-to-Video)');
    } else {
      // Veo 3.1: Prompt estruturado com pesos e comandos imperativos
      const hasPreserveImages = preserveImages && preserveImages.length > 0;
      const hasStyleImages = styleReferenceImages && styleReferenceImages.length > 0;
      
      optimizedPrompt = buildVeo31Prompt(
        safePrompt,
        brandData,
        themeData,
        personaData,
        visualStyle,
        hasPreserveImages,
        hasStyleImages,
        includeText,
        textContent,
        textPosition,
        negativePrompt
      );
      console.log('🎬 Using Veo 3.1 optimized prompt (Text-to-Video)');
    }

    console.log('📏 Optimized prompt length:', optimizedPrompt.length);
    
    // ✅ SELEÇÃO DINÂMICA DE MODELO
    // Veo 3.0 para image_to_video (melhor para conversão de imagem)
    // Veo 3.1 para text_to_video (melhor para geração a partir de texto)
    const modelName = generationType === 'image_to_video' 
      ? 'veo-3.0-generate-001'      // ✅ VEO 3.0 - Otimizado para image-to-video
      : 'veo-3.1-generate-preview';  // ✅ VEO 3.1 - Otimizado para text-to-video
    
    console.log(`🤖 Modelo selecionado: ${modelName}`);
    console.log(`🎯 Tipo de geração: ${generationType}`);
    console.log(`📐 Configurações: ${aspectRatio} • ${resolution} • ${duration}s`);
    
    // Prepare request body com estrutura específica por modelo
    let requestBody: any;
    
    // Função auxiliar para extrair base64 puro (remove prefixo data URL se existir)
    function extractBase64(dataUrl: string): { base64: string; mimeType: string } {
      console.log('🔍 [extractBase64] Input type:', typeof dataUrl);
      console.log('🔍 [extractBase64] Input starts with:', dataUrl?.substring(0, 50) || 'undefined');
      console.log('🔍 [extractBase64] Input length:', dataUrl?.length || 0);
      
      // Verificar se é uma data URL válida
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        console.log('✅ [extractBase64] Data URL format detected');
        console.log('✅ [extractBase64] Extracted mimeType:', match[1]);
        console.log('✅ [extractBase64] Extracted base64 length:', match[2].length);
        return { base64: match[2], mimeType: match[1] };
      }
      
      // Detectar mimeType pelo magic number do base64 se não tiver prefixo
      let mimeType = 'image/png'; // default
      if (dataUrl.startsWith('/9j/')) {
        mimeType = 'image/jpeg';
      } else if (dataUrl.startsWith('iVBORw0KGgo')) {
        mimeType = 'image/png';
      } else if (dataUrl.startsWith('R0lGODlh')) {
        mimeType = 'image/gif';
      } else if (dataUrl.startsWith('UklGR')) {
        mimeType = 'image/webp';
      }
      
      console.log('⚠️ [extractBase64] No data URL prefix found, assuming raw base64');
      console.log('⚠️ [extractBase64] Detected mimeType from magic number:', mimeType);
      return { base64: dataUrl, mimeType };
    }

    // Validar duração para Veo 3.0 (máximo 8 segundos)
    let validatedDuration = duration;
    const MAX_DURATION_VEO30 = 8;
    if (generationType === 'image_to_video' && duration > MAX_DURATION_VEO30) {
      console.warn(`⚠️ Duration ${duration}s exceeds Veo 3.0 limit, capping at ${MAX_DURATION_VEO30}s`);
      validatedDuration = MAX_DURATION_VEO30;
    }

    if (generationType === 'image_to_video') {
      // ✅ VEO 3.0: Estrutura específica para image-to-video
      // Documentação: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo
      
      console.log('🖼️ [DEBUG] preserveImages array length:', preserveImages?.length);
      console.log('🖼️ [DEBUG] preserveImages[0] type:', typeof preserveImages?.[0]);
      console.log('🖼️ [DEBUG] preserveImages[0] starts with:', preserveImages?.[0]?.substring(0, 80));
      
      const { base64: imageBase64, mimeType: imageMimeType } = extractBase64(preserveImages[0]);
      
      // Validar que temos um base64 válido
      if (!imageBase64 || imageBase64.length < 100) {
        console.error('❌ [Veo 3.0] Invalid base64 image data');
        return new Response(
          JSON.stringify({ error: 'Imagem inválida ou corrompida. Por favor, tente novamente com outra imagem.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`🖼️ [Veo 3.0] Imagem extraída - mimeType: ${imageMimeType}, base64 length: ${imageBase64.length}`);
      
      requestBody = {
        instances: [{
          prompt: optimizedPrompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: imageMimeType
          }
        }],
        parameters: {
          aspectRatio: aspectRatio,
          durationSeconds: validatedDuration
        }
      };
      
      console.log(`🖼️ [Veo 3.0] Usando 1 imagem para image-to-video`);
      console.log(`🖼️ [Veo 3.0] Duração validada: ${validatedDuration}s`);
    } else {
      // ✅ VEO 3.1: Estrutura para text-to-video
      requestBody = {
        instances: [{
          prompt: optimizedPrompt
        }],
        parameters: {
          aspectRatio: aspectRatio,
          resolution: resolution,
          durationSeconds: duration
        }
      };
      
      // Adicionar imagens de preservação como referenceImages principais
      if (preserveImages && preserveImages.length > 0) {
        requestBody.instances[0].referenceImages = preserveImages.map((img: string) => ({
          image: {
            bytesBase64Encoded: img,
            mimeType: 'image/png'
          },
          referenceType: 'asset'  // Tipo 'asset' para identidade visual
        }));
        console.log(`🎨 [Veo 3.1] ${preserveImages.length} imagem(ns) com identidade preservada`);
      }
      
      // Adicionar imagens de estilo como referências adicionais (se houver espaço)
      if (styleReferenceImages && styleReferenceImages.length > 0) {
        const existingCount = requestBody.instances[0].referenceImages?.length || 0;
        const spaceLeft = 3 - existingCount; // Veo 3.1 suporta até 3 imagens
        
        if (spaceLeft > 0) {
          const styleToAdd = styleReferenceImages.slice(0, spaceLeft).map((img: string) => ({
            image: {
              bytesBase64Encoded: img,
              mimeType: 'image/png'
            },
            referenceType: 'style'  // Tipo 'style' para inspiração
          }));
          
          requestBody.instances[0].referenceImages = [
            ...(requestBody.instances[0].referenceImages || []),
            ...styleToAdd
          ];
          console.log(`🖌️ [Veo 3.1] ${styleToAdd.length} imagem(ns) de estilo adicionadas`);
        } else {
          console.log(`⚠️ [Veo 3.1] Limite de 3 imagens atingido, ignorando imagens de estilo`);
        }
      }
    }

    // Adicionar prompt negativo se fornecido (vai em parameters)
    if (negativePrompt && negativePrompt.trim()) {
      requestBody.parameters.negativePrompt = negativePrompt;
      console.log('⛔ Negative prompt:', negativePrompt);
    }
    
    console.log('📦 Request body preparado:', JSON.stringify(requestBody, null, 2));

    // Start video generation with selected model
    console.log(`Starting video generation with ${modelName}...`);
    const generateResponse = await fetch(
      `${BASE_URL}/models/${modelName}:predictLongRunning`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('❌ Video generation API error:', {
        status: generateResponse.status,
        statusText: generateResponse.statusText,
        body: errorText,
        modelUsed: modelName,
        generationType: generationType,
        imageProvided: !!preserveImages?.[0],
        imageMimeType: preserveImages?.[0] ? extractBase64(preserveImages[0]).mimeType : 'N/A',
        promptLength: optimizedPrompt.length
      });
      
      // Verificar se é um erro que justifica reembolso de créditos
      // 429 (quota/rate limit), 500+ (server errors), 503 (service unavailable)
      const shouldRefundCredits = generateResponse.status === 429 || 
                                   generateResponse.status >= 500;
      
      let userMessage = 'Erro na geração de vídeo';
      let refundedCredits = false;
      
      // Reembolsar créditos para erros de quota/servidor (não foi consumido recurso da API)
      if (shouldRefundCredits) {
        console.log('💰 Reembolsando créditos devido a erro da API...');
        
        // Buscar créditos atuais do usuário
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', actionData.user_id)
          .single();
        
        if (currentProfile) {
          const refundedCreditsAfter = currentProfile.credits + CREDIT_COSTS.VIDEO_GENERATION;
          
          // Devolver créditos ao usuário
          await supabase
            .from('profiles')
            .update({ credits: refundedCreditsAfter })
            .eq('id', actionData.user_id);
          
          // Registrar reembolso no histórico
          await recordUserCreditUsage(supabase, {
            userId: actionData.user_id,
            teamId: actionData.team_id || undefined,
            actionType: 'VIDEO_GENERATION_REFUND',
            creditsUsed: -CREDIT_COSTS.VIDEO_GENERATION,
            creditsBefore: currentProfile.credits,
            creditsAfter: refundedCreditsAfter,
            description: `Reembolso: Erro ${generateResponse.status} na API de vídeo`,
            metadata: { 
              action_id: actionId, 
              error_status: generateResponse.status,
              reason: generateResponse.status === 429 ? 'quota_exceeded' : 'server_error'
            }
          });
          
          refundedCredits = true;
          console.log(`✅ Créditos reembolsados: ${currentProfile.credits} → ${refundedCreditsAfter}`);
        }
        
        // Mensagens amigáveis para o usuário
        if (generateResponse.status === 429) {
          userMessage = 'A API de vídeo atingiu o limite de uso. Seus créditos foram reembolsados. Tente novamente em alguns minutos.';
        } else {
          userMessage = 'Erro temporário no servidor de vídeo. Seus créditos foram reembolsados. Tente novamente.';
        }
      }
      
      // Atualizar action para failed
      await supabase
        .from('actions')
        .update({
          status: 'failed',
          result: { 
            error: userMessage,
            apiStatus: generateResponse.status,
            modelUsed: modelName,
            generationType: generationType,
            creditsRefunded: refundedCredits,
            failedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', actionId);
      
      // Para erros esperados de quota/rate limit, retornamos 200 para o frontend tratar sem "Edge function returned 429".
      const httpStatus = generateResponse.status;
      const responseStatus = shouldRefundCredits ? 200 : httpStatus;

      return new Response(
        JSON.stringify({
          error: userMessage,
          details: errorText,
          modelUsed: modelName,
          generationType: generationType,
          creditsRefunded: refundedCredits,
          httpStatus,
          status: 'failed',
        }),
        { status: responseStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const operationData = await generateResponse.json();
    const operationName = operationData.name;
    
    if (!operationName) {
      console.error('No operation name returned');
      return new Response(
        JSON.stringify({ error: 'Failed to start video generation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Operation started:', operationName);

    // Usar EdgeRuntime.waitUntil para manter o processamento em background
    // Isso garante que a função continue executando até o vídeo ser processado
    const backgroundPromise = processVideoGeneration(operationName, actionId, actionData.user_id, actionData.team_id).catch(err => {
      console.error('Background video processing error:', err);
    });
    
    // EdgeRuntime.waitUntil mantém a função viva até a promise resolver
    // @ts-ignore - EdgeRuntime é disponível no ambiente Deno/Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      console.log('✅ Using EdgeRuntime.waitUntil for background processing');
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundPromise);
    } else {
      console.log('⚠️ EdgeRuntime.waitUntil not available, using fallback');
      // Fallback: aguardar um pouco para iniciar o processo
      backgroundPromise;
    }

    // Retornar imediatamente com status de processamento
    return new Response(
      JSON.stringify({ 
        status: 'processing',
        message: 'Video generation started. Check action status for updates.',
        operationName: operationName,
        actionId: actionId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-video function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
