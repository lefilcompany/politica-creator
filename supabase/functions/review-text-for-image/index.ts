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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;

    // Fetch user's profile (team_id is optional now)
    const [profileResult, politicalProfile] = await Promise.all([
      supabase.from('profiles').select('team_id, credits').eq('id', authenticatedUserId).single(),
      fetchPoliticalProfile(supabase, authenticatedUserId)
    ]);
    const { data: profile, error: profileError } = profileResult;

    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedTeamId = profile?.team_id || null;

    const { text, prompt, brandId, brandName, themeName } = await req.json();

    // Input validation
    if (!text || typeof text !== 'string' || text.length > 8000) {
      return new Response(
        JSON.stringify({ error: 'Invalid text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user credits (individual)
    const creditCheck = await checkUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.TEXT_REVIEW);

    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ 
          error: 'Créditos insuficientes', 
          required: CREDIT_COSTS.TEXT_REVIEW,
          available: creditCheck.currentCredits 
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build AI prompt
    const systemPrompt = `Você é um especialista em copywriting para redes sociais e design de posts.
Analise textos que serão inseridos em imagens de posts (frases, mensagens, citações, títulos, CTAs, etc.) de forma profunda, considerando clareza, impacto visual, legibilidade, adequação ao espaço da imagem, tom de voz e efetividade da mensagem.
Forneça análise estruturada, educacional e acionável com score de qualidade, pontos positivos, sugestões específicas e versões otimizadas do texto.`;

    const politicalContext = buildPoliticalContext(politicalProfile);
    const contextPrompt = `${brandName ? `Marca: ${brandName}\n` : ''}${themeName ? `Tema Estratégico: ${themeName}\n` : ''}${politicalContext}
Contexto da imagem e ajustes desejados: ${prompt}

TEXTO QUE SERÁ INSERIDO NA IMAGEM:
${text}

Analise o texto que será colocado NA IMAGEM do post e retorne uma revisão completa em markdown seguindo EXATAMENTE esta estrutura:

## 📊 Análise do Texto

**Score de Qualidade**: [número de 1-10]/10

**Justificativa do Score**: [breve explicação do score considerando clareza, impacto e adequação ao formato visual]

---

### ✅ Pontos Fortes
- [Clareza da mensagem]
- [Impacto visual do texto]
- [Adequação ao espaço da imagem]
- [Tom de voz apropriado]

---

### ⚠️ Pontos de Melhoria
- [Tamanho do texto (muito longo/curto)]
- [Palavras complexas ou difíceis de ler]
- [Falta de gancho emocional]
- [Problemas de hierarquia visual]

---

### 🎨 Análise de Adequação Visual

**Legibilidade**: [Análise se o texto é fácil de ler em diferentes tamanhos e fundos]

**Tamanho Ideal**: [Se o texto está muito longo, muito curto ou adequado para a imagem]

**Hierarquia Visual**: [Análise de títulos, subtítulos, frases de destaque]

**Quebras de Linha**: [Sugestões de onde quebrar o texto para melhor leitura]

**Formatação Recomendada**: [Negrito, itálico, CAPS, emojis estratégicos, etc.]

---

### 💡 Versões Otimizadas

#### 1️⃣ Versão Impacto
[Versão focada em gerar máximo impacto emocional e visual, texto direto e poderoso]

#### 2️⃣ Versão Didática
[Versão mais explicativa e educativa, mantendo clareza e completude da informação]

#### 3️⃣ Versão Minimalista
[Versão ultra-resumida, apenas o essencial, ideal para imagens clean e com muito espaço visual]

---

### 🎯 Dicas de Formatação Visual

**Sugestão de Emojis**: [Quais emojis adicionar e onde para reforçar a mensagem]

**Destaque de Palavras-chave**: [Quais palavras colocar em CAPS ou negrito]

**Estrutura de Parágrafos**: [Como organizar visualmente o texto na imagem]

**Call-to-Action**: [Sugestões de CTA se aplicável ao contexto]

---

### 📱 Adaptação para Plataformas

**Instagram Feed**: [Como adaptar o texto para post do feed]

**Instagram Stories**: [Como adaptar para stories com espaço limitado]

**LinkedIn**: [Como adaptar para formato mais profissional]

**Facebook**: [Como adaptar considerando espaço e público]

---

### 🎯 Recomendações Finais
[Resumo das principais melhorias e próximos passos para otimizar o texto]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'OpenAI rate limit exceeded. Try again in a moment.' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid OpenAI API key' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'OpenAI API error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const review = data.choices?.[0]?.message?.content || 'Unable to generate review';

    // Save to actions table
    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .insert({
        type: 'REVISAR_CONTEUDO',
        user_id: authenticatedUserId,
        team_id: authenticatedTeamId || '00000000-0000-0000-0000-000000000000',
        brand_id: brandId || null,
        details: { 
          reviewType: 'text-for-image',
          text, 
          prompt, 
          brandName, 
          themeName 
        },
        result: { review },
        status: 'Concluída'
      })
      .select()
      .single();

    if (actionError) {
      console.error('Error saving action:', actionError);
    }

    // Deduct credit (individual)
    const deductResult = await deductUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.TEXT_REVIEW);
    
    if (!deductResult.success) {
      console.error('Error updating credits:', deductResult.error);
    }

    // Record credit usage
    await recordUserCreditUsage(supabase, {
      userId: authenticatedUserId,
      teamId: authenticatedTeamId,
      actionType: 'TEXT_REVIEW',
      creditsUsed: CREDIT_COSTS.TEXT_REVIEW,
      creditsBefore: creditCheck.currentCredits,
      creditsAfter: deductResult.newCredits,
      description: 'Revisão de copy/texto',
      metadata: { brandName, themeName }
    });

    return new Response(
      JSON.stringify({ review, actionId: actionData?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in review-text-for-image:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
