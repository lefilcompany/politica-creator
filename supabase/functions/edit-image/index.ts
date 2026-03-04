import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PROMPT_LENGTH = 8000;

function cleanInput(text: string | undefined | null): string {
  if (!text) return '';
  let cleanedText = text.replace(/[<>{}\[\]"`]/g, '');
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  return cleanedText;
}

function buildRevisionPrompt(
  adjustment: string, 
  brandData: any | null, 
  themeData: any | null,
  hasLogo: boolean,
  platform?: string,
  aspectRatio?: string
): string {
  let promptParts: string[] = [
    "🎨 VOCÊ É UM EDITOR DE IMAGENS ESPECIALIZADO. SUA MISSÃO: APLICAR EXATAMENTE O QUE O USUÁRIO SOLICITOU.",
    "",
    "🎯 INSTRUÇÃO DO USUÁRIO (EXECUTE ISTO COM PRECISÃO):",
    `"${cleanInput(adjustment)}"`,
    "",
    "⚠️ REGRAS CRÍTICAS:",
    "1. VOCÊ DEVE aplicar modificações VISÍVEIS e SIGNIFICATIVAS conforme solicitado",
    "2. Se o usuário pedir para mudar COR, altere as cores de forma CLARA",
    "3. Se pedir para adicionar/remover OBJETOS, faça isso CLARAMENTE",
    "4. Se pedir para mudar TAMANHO/POSIÇÃO, execute EXATAMENTE",
    "5. NUNCA retorne a imagem original sem modificações",
    "6. Mantenha qualidade profissional e realismo",
    "7. Se a instrução não for clara, interprete da forma mais lógica e aplique mudanças visíveis",
    ""
  ];

  // Adicionar contexto de plataforma se disponível
  if (platform || aspectRatio) {
    promptParts.push("📱 CONTEXTO DA PLATAFORMA:");
    if (platform) promptParts.push(`- Plataforma: ${platform}`);
    if (aspectRatio) promptParts.push(`- Proporção: ${aspectRatio}`);
    promptParts.push("");
  }

  if (hasLogo) {
    promptParts.push(
      "🏷️ LOGO DA MARCA:",
      "- A marca possui um logo definido",
      "- Reserve espaço apropriado para o logo se for o caso",
      "- Garanta que a estética se alinhe com a identidade visual da marca",
      ""
    );
  }

  if (brandData) {
    promptParts.push("🎯 IDENTIDADE DA MARCA (seguir estas diretrizes):");
    
    if (brandData.name) promptParts.push(`📌 Nome: ${cleanInput(brandData.name)}`);
    if (brandData.segment) promptParts.push(`🏢 Segmento: ${cleanInput(brandData.segment)}`);
    if (brandData.values) promptParts.push(`💎 Valores: ${cleanInput(brandData.values)}`);
    if (brandData.promise) promptParts.push(`✨ Promessa: ${cleanInput(brandData.promise)}`);
    
    if (brandData.color_palette) {
      try {
        const colors = typeof brandData.color_palette === 'string' 
          ? JSON.parse(brandData.color_palette) 
          : brandData.color_palette;
        promptParts.push(`🎨 Paleta de Cores: ${JSON.stringify(colors)} - Use estas cores harmoniosamente`);
      } catch (e) {
        console.error('Erro ao processar paleta de cores:', e);
      }
    }
    
    if (brandData.restrictions) {
      promptParts.push(`🚫 NÃO FAZER: ${cleanInput(brandData.restrictions)}`);
    }
    
    if (brandData.keywords) promptParts.push(`🔑 Palavras-chave: ${cleanInput(brandData.keywords)}`);
    if (brandData.goals) promptParts.push(`🎯 Metas: ${cleanInput(brandData.goals)}`);
    
    promptParts.push("");
  }

  if (themeData) {
    promptParts.push("🎭 TEMA ESTRATÉGICO:");
    
    if (themeData.title) promptParts.push(`📋 Título: ${cleanInput(themeData.title)}`);
    if (themeData.description) promptParts.push(`📝 Descrição: ${cleanInput(themeData.description)}`);
    if (themeData.tone_of_voice) promptParts.push(`🗣️ Tom de Voz: ${cleanInput(themeData.tone_of_voice)}`);
    if (themeData.objectives) promptParts.push(`🎯 Objetivos: ${cleanInput(themeData.objectives)}`);
    if (themeData.target_audience) promptParts.push(`👥 Público: ${cleanInput(themeData.target_audience)}`);
    if (themeData.content_format) promptParts.push(`📄 Formato: ${cleanInput(themeData.content_format)}`);
    if (themeData.expected_action) promptParts.push(`⚡ Ação Esperada: ${cleanInput(themeData.expected_action)}`);
    
    if (themeData.color_palette) {
      promptParts.push(`🎨 Paleta do Tema: ${themeData.color_palette}`);
    }
    
    if (themeData.hashtags) promptParts.push(`#️⃣ Hashtags: ${cleanInput(themeData.hashtags)}`);
    
    promptParts.push("");
  }

  promptParts.push(
    "✅ RESULTADO ESPERADO:",
    "- Imagem editada com ALTA QUALIDADE e REALISMO PROFISSIONAL",
    "- Ajuste solicitado aplicado de forma VISÍVEL e EFETIVA",
    "- Alinhamento perfeito com identidade de marca e tema (se fornecidos)",
    "- Composição visualmente impactante e apropriada para redes sociais",
    ""
  );

  const finalPrompt = promptParts.join('\n');
  
  // Se exceder o limite, priorizar as informações mais importantes
  if (finalPrompt.length > MAX_PROMPT_LENGTH) {
    console.warn(`⚠️ Prompt muito longo (${finalPrompt.length} chars), truncando...`);
    return finalPrompt.substring(0, MAX_PROMPT_LENGTH);
  }
  
  return finalPrompt;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewPrompt, imageUrl, brandId, themeId, platform, aspectRatio } = await req.json();

    console.log('📝 [EDIT-IMAGE] Dados recebidos:', {
      brandId,
      themeId,
      hasImageUrl: !!imageUrl,
      promptLength: reviewPrompt?.length || 0
    });

    if (!reviewPrompt || !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'reviewPrompt e imageUrl são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Configuração do Supabase não encontrada');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('❌ Erro ao obter usuário:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile (team_id is optional now)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('team_id, credits')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Erro ao obter perfil do usuário:', profileError);
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teamId = profile?.team_id || null;

    // Check user credits (individual)
    const creditCheck = await checkUserCredits(supabase, user.id, CREDIT_COSTS.IMAGE_EDIT);

    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: 'Créditos insuficientes' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch complete brand data if brandId is provided
    let brandData = null;
    if (brandId) {
      console.log('🔍 Buscando dados da marca...');
      const { data, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();

      if (brandError) {
        console.error('⚠️ Erro ao buscar marca:', brandError);
      } else {
        brandData = data;
      }
    }

    // Fetch theme data if themeId is provided
    let themeData = null;
    if (themeId) {
      console.log('🔍 Buscando dados do tema...');
      const { data, error: themeError } = await supabase
        .from('strategic_themes')
        .select('*')
        .eq('id', themeId)
        .single();

      if (!themeError && data) {
        themeData = data;
      }
    }

    // Build detailed prompt with brand and theme context
    const hasLogo = brandData?.logo ? true : false;
    const detailedPrompt = buildRevisionPrompt(reviewPrompt, brandData, themeData, hasLogo, platform, aspectRatio);

    console.log('📝 [EDIT-IMAGE] Prompt detalhado gerado:');
    console.log('   - Comprimento:', detailedPrompt.length, 'caracteres');
    console.log('   - Tem dados de marca:', !!brandData);
    console.log('   - Tem dados de tema:', !!themeData);
    console.log('   - Plataforma:', platform || 'não especificada');
    console.log('   - Aspect Ratio:', aspectRatio || 'não especificado');
    console.log('   - Ajuste solicitado:', reviewPrompt.substring(0, 100) + '...');

    // GEMINI_API_KEY is checked inline below
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🤖 Chamando Lovable AI Gateway para edição de imagem...');

    // Preparar imagem como data URL para o gateway
    let imageDataUrl: string;
    
    if (imageUrl.startsWith('data:')) {
      imageDataUrl = imageUrl;
      console.log('📷 Imagem recebida como base64');
    } else {
      console.log('📷 Baixando imagem da URL:', imageUrl);
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Erro ao baixar imagem: ${imageResponse.status}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const bytes = new Uint8Array(imageBuffer);
      let binary = '';
      const chunkSize = 8192;
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      
      const contentType = imageResponse.headers.get('content-type') || 'image/png';
      imageDataUrl = `data:${contentType};base64,${btoa(binary)}`;
      console.log('✅ Imagem convertida para base64, tipo:', contentType);
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    const geminiParts: any[] = [{ text: detailedPrompt }];
    if (imageDataUrl.startsWith('data:')) {
      const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        geminiParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: geminiParts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    console.log('📡 Status da resposta Gemini:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro no Gemini:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    console.log('✅ Resposta da AI recebida');

    // Extrair imagem da resposta Gemini (inline_data)
    let editedImageDataUrl: string | null = null;

    const candidates = aiData.candidates?.[0]?.content?.parts;
    if (candidates) {
      for (const part of candidates) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          editedImageDataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          console.log('✅ Image extracted from Gemini inlineData');
          break;
        }
      }
    }
    
    if (!editedImageDataUrl) {
      console.error('❌ Imagem editada não foi retornada pela API');
      console.error('📊 Keys:', JSON.stringify(Object.keys(aiData), null, 2));
      throw new Error('A IA não conseguiu processar sua solicitação. Tente reformular o pedido de edição de forma mais específica.');
    }

    console.log('📤 Fazendo upload da imagem editada para Storage...');

    // Extract base64 data from data URL
    const base64Data = editedImageDataUrl.split(',')[1] || editedImageDataUrl;
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const uploadBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uploadBytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID();
    const fileName = `edited-images/${timestamp}-${randomId}.png`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content-images')
      .upload(fileName, uploadBytes, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erro ao fazer upload:', uploadError);
      throw new Error(`Erro ao fazer upload da imagem: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('content-images')
      .getPublicUrl(fileName);

    console.log('✅ Imagem editada com sucesso e armazenada:', publicUrl);

    // Deduct credit after successful edit (individual)
    const deductResult = await deductUserCredits(supabase, user.id, CREDIT_COSTS.IMAGE_EDIT);
    
    if (!deductResult.success) {
      console.error('❌ Erro ao deduzir créditos:', deductResult.error);
    } else {
      console.log(`✅ ${CREDIT_COSTS.IMAGE_EDIT} crédito deduzido do usuário ${user.id}`);
      
      // Record credit usage
      await recordUserCreditUsage(supabase, {
        userId: user.id,
        teamId: teamId,
        actionType: 'IMAGE_EDIT',
        creditsUsed: CREDIT_COSTS.IMAGE_EDIT,
        creditsBefore: creditCheck.currentCredits,
        creditsAfter: deductResult.newCredits,
        description: 'Edição de imagem',
        metadata: {
          image_url: publicUrl,
          brand_id: brandId,
          theme_id: themeId,
          platform: platform,
          aspect_ratio: aspectRatio
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        editedImageUrl: publicUrl,
        creditsRemaining: deductResult.newCredits
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na função edit-image:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao editar imagem'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
