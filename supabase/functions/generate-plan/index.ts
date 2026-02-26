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
    // Log request details for debugging
    console.log('Generate plan request received');
    
    // Validate authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { brand, themes, platform, quantity, objective, additionalInfo, userId, teamId } = await req.json();
    console.log('Request payload:', { brand, themes, platform, quantity, userId, teamId });

    // Input validation
    if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Brand is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!themes || !Array.isArray(themes) || themes.length === 0 || themes.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Themes must be an array with 1-10 items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const validPlatforms = ['instagram', 'linkedin', 'facebook', 'twitter', 'tiktok'];
    const normalizedPlatform = platform.toLowerCase().trim();
    if (!normalizedPlatform || !validPlatforms.includes(normalizedPlatform)) {
      console.error('Invalid platform:', platform);
      return new Response(
        JSON.stringify({ error: 'Invalid platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!quantity || typeof quantity !== 'number' || quantity < 1 || quantity > 50) {
      return new Response(
        JSON.stringify({ error: 'Quantity must be between 1 and 50' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!objective || typeof objective !== 'string' || objective.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Invalid objective' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (additionalInfo && typeof additionalInfo === 'string' && additionalInfo.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Additional info too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch political profile in parallel with credit check
    const [creditCheck, politicalProfile] = await Promise.all([
      checkUserCredits(supabase, userId, CREDIT_COSTS.CONTENT_PLAN),
      fetchPoliticalProfile(supabase, userId)
    ]);

    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: 'Créditos insuficientes' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch brand details
    const { data: brandData } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand)
      .single();

    // Fetch theme details
    const { data: themeData } = await supabase
      .from('strategic_themes')
      .select('*')
      .in('id', themes);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Você é um especialista em planejamento de conteúdo estratégico para redes sociais.

IMPORTANTE: Você DEVE gerar EXATAMENTE ${quantity} post(s) completo(s).

Use a seguinte estrutura para o planejamento:

# Plano de Conteúdo Estratégico

## Marca: [Nome da Marca]

## Tema(s): [Temas Estratégicos]

## Plataforma: [Plataforma]

## Quantidade de Posts: ${quantity}

## Objetivo Principal: [Objetivo]

---

## SUGESTÕES DE POSTS

Para CADA UM dos ${quantity} posts, siga EXATAMENTE este formato:

### Post [N] - [Título Descritivo e Chamativo]

**Objetivo:** [Objetivo específico - ex: Autoridade, Prova Social, Educação, Cultura/Marca]

**Funil:** [Topo, Meio ou Fundo]

**Persona:** [Descrição específica do público-alvo]

**Grande Ideia:** [Conceito principal em uma frase impactante]

**Formato:** [Tipo de conteúdo - Reels, Carrossel, IGTV, Post estático, etc]

**Copy Sugerida:** [Texto completo e detalhado da legenda, incluindo call-to-action]

**Imagem/Vídeo:** [Descrição visual detalhada do conteúdo, incluindo elementos visuais, cores, composição]

**Hashtags:** [5-10 hashtags relevantes]

**Melhor Horário:** [Sugestão de horário para publicação baseado no comportamento da persona]

---

IMPORTANTE: Certifique-se de que TODOS os ${quantity} posts estejam completos e bem estruturados.`;

    let brandContext = '';
    if (brandData) {
      brandContext = `
Contexto da Marca:
- Nome: ${brandData.name}
- Segmento: ${brandData.segment}
- Valores: ${brandData.values || 'Não especificado'}
- Promessa: ${brandData.promise || 'Não especificado'}
- Palavras-chave: ${brandData.keywords || 'Não especificado'}
- Objetivos: ${brandData.goals || 'Não especificado'}
`;
    }

    let themesContext = '';
    if (themeData && themeData.length > 0) {
      themesContext = '\nTemas Estratégicos:\n';
      themeData.forEach((theme: any, index: number) => {
        themesContext += `
Tema ${index + 1}:
- Título: ${theme.title}
- Descrição: ${theme.description}
- Tom de voz: ${theme.tone_of_voice}
- Público-alvo: ${theme.target_audience}
- Ação esperada: ${theme.expected_action}
- Melhores formatos: ${theme.best_formats}
`;
      });
    }

    const politicalContext = buildPoliticalContext(politicalProfile);
    const userPrompt = `${brandContext}\n${themesContext}\n${politicalContext}\n\nPlataforma: ${platform}\nQuantidade de Posts: ${quantity}\nObjetivo: ${objective}\n${additionalInfo ? `Informações Adicionais: ${additionalInfo}` : ''}\n\nPor favor, gere um plano estratégico completo com EXATAMENTE ${quantity} post(s) seguindo a estrutura fornecida.`;

    console.log('Calling OpenAI API with gpt-4o model...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        console.error('OpenAI API authentication failed');
        return new Response(
          JSON.stringify({ error: 'Erro de autenticação com o serviço de IA. Entre em contato com o suporte.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Entre em contato com o suporte.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro no serviço de IA: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('OpenAI API response received successfully');

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response format:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do serviço de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const generatedPlan = data.choices[0].message.content;

    // Deduct credits (individual)
    const deductResult = await deductUserCredits(supabase, userId, CREDIT_COSTS.CONTENT_PLAN);

    if (!deductResult.success) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar créditos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record credit usage
    await recordUserCreditUsage(supabase, {
      userId,
      teamId: teamId || null,
      actionType: 'CONTENT_PLAN',
      creditsUsed: CREDIT_COSTS.CONTENT_PLAN,
      creditsBefore: creditCheck.currentCredits,
      creditsAfter: deductResult.newCredits,
      description: 'Planejamento de conteúdo',
      metadata: { platform, quantity, themes }
    });

    // Save action
    const { data: actionData, error: insertError } = await supabase
      .from('actions')
      .insert({
        type: 'PLANEJAR_CONTEUDO',
        user_id: userId,
        team_id: teamId || '00000000-0000-0000-0000-000000000000',
        brand_id: brand,
        status: 'Aguardando revisão',
        result: { plan: generatedPlan },
        details: { themes, platform, quantity, objective, additionalInfo }
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error saving action:', insertError);
      return new Response(
        JSON.stringify({ error: 'Unable to save plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        plan: generatedPlan,
        actionId: actionData.id,
        creditsRemaining: deductResult.newCredits 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
