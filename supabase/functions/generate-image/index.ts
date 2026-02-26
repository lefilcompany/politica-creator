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
// VIBE STYLES - Mapeamento de Vibes
// =====================================
const VIBE_STYLES: Record<string, string> = {
  minimalist: "Fotografia flat lay estúdio, fundo limpo, espaço negativo amplo, composição equilibrada, tons neutros elegantes",
  pop_neon: "Cores saturadas, iluminação neon, contraste forte, estilo arte urbana, vibrante e energético",
  professional: "Fotografia corporativa de alta qualidade, profundidade de campo rasa, tons neutros, iluminação studio profissional",
  cinematic: "Fotografia cinematográfica 4K, color grading de filme, composição dramática, iluminação volumétrica",
  "3d_modern": "3D render minimalista, iluminação studio suave, materiais realistas, composição clean moderna",
  illustration: "Ilustração vetorial moderna, cores vibrantes, formas geométricas, design gráfico contemporâneo",
  // Legacy styles mapping
  realistic: "Fotografia de alta qualidade, hiper-realista, 8K, iluminação natural profissional",
  animated: "3D animado estilo Pixar/Disney, renderização estilizada, cores vibrantes",
  cartoon: "Ilustração cartoon, contornos marcados, cores planas, design expressivo",
  anime: "Estilo anime japonês, cel-shading, lineart detalhada",
  watercolor: "Estilo aquarela, pinceladas suaves, textura artística",
  oil_painting: "Estilo pintura a óleo, texturas ricas, pinceladas visíveis",
  digital_art: "Arte digital profissional, conceito art, renderização polida",
  sketch: "Estilo desenho a lápis, linhas expressivas, grafite sobre papel",
  vintage: "Estética vintage retrô, color grading nostálgico, grain de filme, tons quentes",
};

// =====================================
// FONT STYLES - Mapeamento de Tipografia
// =====================================
const FONT_STYLES: Record<string, string> = {
  elegant: "serifa clássica, refinada, com elegância tipográfica",
  modern: "sans-serif limpa, geométrica, moderna e minimalista",
  fun: "script casual ou display arrojada, divertida e expressiva",
  impactful: "bold condensada, display forte, grande impacto visual",
};

// =====================================
// TONE/OBJECTIVE → VISUAL PARAMETERS MAP (Political)
// =====================================
const TONE_VISUAL_MAP: Record<string, { contrast: string; lighting: string; style: string; composition: string; focus: string; description: string }> = {
  combativo: {
    contrast: "High",
    lighting: "Dramatic, low-key, strong shadows",
    style: "Bold, impactful, high contrast",
    composition: "Dynamic, asymmetric, tension-driven",
    focus: "Power, urgency, strength",
    description: "Gera urgência e força. Cores intensas, tipografia impactante, contrastes fortes."
  },
  didatico: {
    contrast: "Medium",
    lighting: "Even, clean, bright studio",
    style: "Clean/Grid, Infographic elements",
    composition: "Organized, grid-based, clear hierarchy",
    focus: "Data comprehension, clarity, trust",
    description: "Facilita a compreensão de dados. Layout limpo, elementos infográficos, tons neutros."
  },
  emocional: {
    contrast: "Low-Medium",
    lighting: "Warm/Golden Hour, soft natural light",
    style: "Warm, human-centered, empathetic",
    composition: "Close-ups, human focus, intimate framing",
    focus: "People/Expressions, human connection",
    description: "Gera conexão humana e empatia. Iluminação quente, foco em pessoas e expressões."
  },
  institucional: {
    contrast: "Low",
    lighting: "Clean, balanced, professional studio",
    style: "Minimalist, formal, authoritative",
    composition: "Symmetrical, centered, stable",
    focus: "Order, stability, governance",
    description: "Transmite estabilidade e ordem. Estilo minimalista, composição simétrica."
  },
};

// =====================================
// FETCH COMPLETE DATA FROM DB
// =====================================
async function fetchBrandData(supabase: any, brandId: string) {
  const { data, error } = await supabase
    .from('brands')
    .select('name, segment, values, keywords, color_palette, brand_color, goals, promise, restrictions, logo, moodboard, reference_image')
    .eq('id', brandId)
    .single();
  if (error) { console.error('Error fetching brand:', error); return null; }
  return data;
}

async function fetchThemeData(supabase: any, themeId: string) {
  const { data, error } = await supabase
    .from('strategic_themes')
    .select('title, description, tone_of_voice, platforms, target_audience, objectives, macro_themes, objective_type, color_palette, hashtags')
    .eq('id', themeId)
    .single();
  if (error) { console.error('Error fetching theme:', error); return null; }
  return data;
}

async function fetchPersonaData(supabase: any, personaId: string) {
  const { data, error } = await supabase
    .from('personas')
    .select('name, age, gender, location, professional_context, preferred_tone_of_voice, challenges, main_goal, beliefs_and_interests')
    .eq('id', personaId)
    .single();
  if (error) { console.error('Error fetching persona:', error); return null; }
  return data;
}

// =====================================
// STEP 1: ENRICH PROMPT WITH GEMINI FLASH
// =====================================
async function enrichPromptWithFlash(
  rawDescription: string,
  brandData: any,
  themeData: any,
  personaData: any,
  politicalContext: string,
  politicalTone?: string,
  politicalProfile?: any
): Promise<{ enrichedDescription: string; briefingVisual: string; copywriting: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.warn('LOVABLE_API_KEY not found, skipping enrichment');
    return { enrichedDescription: rawDescription, briefingVisual: '', copywriting: '' };
  }

  const toneParams = TONE_VISUAL_MAP[politicalTone || ''] || TONE_VISUAL_MAP['institucional'];

  const contextParts: string[] = [];
  if (brandData) {
    contextParts.push(`Marca: ${brandData.name}, Segmento: ${brandData.segment || 'N/A'}, Valores: ${brandData.values || 'N/A'}`);
  }
  if (themeData) {
    contextParts.push(`Pauta: ${themeData.title}, Objetivos: ${themeData.objectives || 'N/A'}, Macro-temas: ${themeData.macro_themes || 'N/A'}`);
  }
  if (personaData) {
    contextParts.push(`Audiência: ${personaData.name}, ${personaData.age || ''} anos, ${personaData.location || ''}, Contexto: ${personaData.professional_context || 'N/A'}`);
  }
  if (politicalProfile) {
    if (politicalProfile.political_role) contextParts.push(`Cargo: ${politicalProfile.political_role}`);
    if (politicalProfile.political_level) contextParts.push(`Nível: ${politicalProfile.political_level}`);
    if (politicalProfile.mandate_stage) contextParts.push(`Fase: ${politicalProfile.mandate_stage}`);
  }

  const systemPrompt = `Você é um Consultor de Marketing Político e Diretor de Arte de Campanha de Alto Nível.

Sua tarefa: Receber uma descrição bruta e dados contextuais e produzir DOIS outputs:

1. **BRIEFING VISUAL**: Uma scene_description rica e cinematográfica para geração de imagem por IA, detalhando:
   - Iluminação: ${toneParams.lighting}
   - Composição: ${toneParams.composition}
   - Contraste: ${toneParams.contrast}
   - Foco visual: ${toneParams.focus}
   - Estilo: ${toneParams.style}
   - Atmosfera e mood adequados ao tom "${politicalTone || 'institucional'}"
   - Detalhes visuais específicos (texturas, materiais, cores)
   - Elementos de cena regionais quando apropriado

2. **COPYWRITING**: Uma sugestão de headline (max 10 palavras) e subtexto/CTA (max 15 palavras) para a peça.

Contexto: ${contextParts.join(' | ')}
${politicalContext ? `Perfil político: ${politicalContext.substring(0, 500)}` : ''}

FORMATO DE RESPOSTA (JSON):
{
  "briefing_visual": "descrição cinematográfica detalhada...",
  "headline": "texto principal sugerido",
  "subtexto": "CTA ou texto secundário"
}

REGRAS:
- Máximo 300 palavras no briefing_visual
- Em português
- Seja específico e visual, não genérico
- Adapte a estética ao tom: ${toneParams.description}`;

  try {
    console.log('🎨 Step 1: Enriching prompt with Gemini Flash...');
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
          { role: 'user', content: `Transforme esta descrição em um Briefing Visual e Copywriting para campanha política:\n\n"${rawDescription}"` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error(`Flash enrichment failed with status ${status}`);
      if (status === 429) console.warn('Rate limited on enrichment, using original');
      if (status === 402) console.warn('Payment required on enrichment, using original');
      return { enrichedDescription: rawDescription, briefingVisual: '', copywriting: '' };
    }

    const data = await response.json();
    const enriched = data.choices?.[0]?.message?.content?.trim();
    if (enriched && enriched.length > 20) {
      console.log(`✅ Prompt enriched: ${enriched.length} chars`);
      
      // Try to parse as JSON
      try {
        const jsonMatch = enriched.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            enrichedDescription: parsed.briefing_visual || rawDescription,
            briefingVisual: parsed.briefing_visual || '',
            copywriting: [parsed.headline, parsed.subtexto].filter(Boolean).join(' | '),
          };
        }
      } catch (parseErr) {
        console.warn('Could not parse enrichment as JSON, using raw text');
      }
      
      return { enrichedDescription: enriched, briefingVisual: '', copywriting: '' };
    }
    return { enrichedDescription: rawDescription, briefingVisual: '', copywriting: '' };
  } catch (error) {
    console.error('Error enriching prompt:', error);
    return { enrichedDescription: rawDescription, briefingVisual: '', copywriting: '' };
  }
}

// =====================================
// BUILD "DIRETOR DE ARTE DIGITAL" PROMPT
// =====================================
function buildDirectorPrompt(params: {
  userName: string;
  description: string;
  enrichedDescription: string;
  brandData: any;
  themeData: any;
  personaData: any;
  politicalContext: string;
  politicalTone: string;
  vibeStyle: string;
  fontStyle: string;
  includeText: boolean;
  textContent: string;
  textPosition: string;
  contentType: string;
  platform: string;
  objective: string;
  tones: string[];
  additionalInfo: string;
  preserveImagesCount: number;
  styleReferenceImagesCount: number;
  copywritingSuggestion: string;
}): string {
  const sections: string[] = [];
  const toneParams = TONE_VISUAL_MAP[params.politicalTone] || TONE_VISUAL_MAP['institucional'];

  // === ROLE ===
  sections.push(`Atue como um Consultor de Marketing Político e Designer de Campanha de Alto Nível. O seu objetivo é criar uma peça visual impecável para ${params.userName}, respeitando rigorosamente a identidade visual e as diretrizes estratégicas fornecidas abaixo.`);

  // === 1. CONTEXTO DO UTILIZADOR E MARCA ===
  const contextLines: string[] = [];
  if (params.brandData) {
    contextLines.push(`- **Marca:** ${params.brandData.name}`);
    if (params.brandData.segment) contextLines.push(`- **Setor/Nicho:** ${params.brandData.segment}`);
    if (params.brandData.values) contextLines.push(`- **Valores:** ${params.brandData.values}`);
    if (params.brandData.keywords) contextLines.push(`- **Keywords:** ${params.brandData.keywords}`);
    if (params.brandData.promise) contextLines.push(`- **Promessa da marca:** ${params.brandData.promise}`);
    if (params.brandData.goals) contextLines.push(`- **Objetivos:** ${params.brandData.goals}`);
    
    // Color palette
    const colors: string[] = [];
    if (params.brandData.brand_color) colors.push(params.brandData.brand_color);
    if (params.brandData.color_palette && Array.isArray(params.brandData.color_palette)) {
      params.brandData.color_palette.forEach((c: any) => {
        if (c.hex) colors.push(c.hex);
      });
    }
    if (colors.length > 0) {
      contextLines.push(`- **Paleta de Cores Obrigatória:** ${colors.join(', ')}`);
    }
    if (params.brandData.restrictions) {
      contextLines.push(`- **Restrições:** ${params.brandData.restrictions}`);
    }
  }
  if (params.themeData) {
    contextLines.push(`- **Pauta Estratégica:** ${params.themeData.title}`);
    if (params.themeData.objectives) contextLines.push(`- **Objetivos da Pauta:** ${params.themeData.objectives}`);
    if (params.themeData.macro_themes) contextLines.push(`- **Macro-temas:** ${params.themeData.macro_themes}`);
    if (params.themeData.target_audience) contextLines.push(`- **Público-Alvo da Pauta:** ${params.themeData.target_audience}`);
    if (params.themeData.hashtags) contextLines.push(`- **Hashtags:** ${params.themeData.hashtags}`);
  }
  if (params.personaData) {
    contextLines.push(`- **Audiência:** ${params.personaData.name}`);
    if (params.personaData.age) contextLines.push(`- **Idade:** ${params.personaData.age}`);
    if (params.personaData.gender) contextLines.push(`- **Gênero:** ${params.personaData.gender}`);
    if (params.personaData.location) contextLines.push(`- **Localização:** ${params.personaData.location}`);
    if (params.personaData.professional_context) contextLines.push(`- **Contexto Profissional:** ${params.personaData.professional_context}`);
    if (params.personaData.challenges) contextLines.push(`- **Desafios:** ${params.personaData.challenges}`);
    if (params.personaData.main_goal) contextLines.push(`- **Objetivo Principal:** ${params.personaData.main_goal}`);
    if (params.personaData.beliefs_and_interests) contextLines.push(`- **Interesses:** ${params.personaData.beliefs_and_interests}`);
  }

  // Tom de voz
  const toneStr = params.tones.length > 0 ? params.tones.join(', ') : 
    (params.themeData?.tone_of_voice || params.personaData?.preferred_tone_of_voice || 'profissional');
  contextLines.push(`- **Tom de Voz da Marca:** ${toneStr}`);

  if (contextLines.length > 0) {
    sections.push(`### 1. CONTEXTO DO UTILIZADOR E MARCA\n${contextLines.join('\n')}`);
  }

  // === 2. CONTEÚDO E COMPOSIÇÃO DO POST ===
  const compositionLines: string[] = [];
  
  if (params.includeText && params.textContent?.trim()) {
    compositionLines.push(`- **Headline (Texto Principal na Imagem):** "${params.textContent}"`);
  } else if (params.copywritingSuggestion) {
    compositionLines.push(`- **Sugestão de Copywriting (gerada pelo LLM Refiner):** ${params.copywritingSuggestion}`);
  }
  
  compositionLines.push(`- **Descrição da Cena:** ${params.enrichedDescription}`);
  
  const vibeDesc = VIBE_STYLES[params.vibeStyle] || VIBE_STYLES['professional'] || params.vibeStyle;
  compositionLines.push(`- **Estilo Visual:** ${vibeDesc}`);

  // === DIRETRIZES ESTRATÉGICAS (Tom Político) ===
  compositionLines.push(`- **Tom/Objetivo Político:** ${params.politicalTone || 'institucional'}`);
  compositionLines.push(`- **Contraste:** ${toneParams.contrast}`);
  compositionLines.push(`- **Iluminação:** ${toneParams.lighting}`);
  compositionLines.push(`- **Composição:** ${toneParams.composition}`);
  compositionLines.push(`- **Foco Visual:** ${toneParams.focus}`);

  if (params.platform) compositionLines.push(`- **Plataforma:** ${params.platform}`);
  if (params.objective) compositionLines.push(`- **Objetivo:** ${params.objective}`);
  if (params.contentType === 'ads') {
    compositionLines.push(`- **Tipo:** Conteúdo de ANÚNCIO PAGO - foco em conversão, CTA implícito`);
  } else {
    compositionLines.push(`- **Tipo:** Conteúdo ORGÂNICO - foco em engajamento, autenticidade, conexão com comunidade`);
  }

  sections.push(`### 2. CONTEÚDO E COMPOSIÇÃO DO POST\n${compositionLines.join('\n')}`);

  // === 3. INSTRUÇÕES CRUCIAIS DE DESIGN ===
  const designLines: string[] = [];
  
  if (params.includeText && params.textContent?.trim()) {
    const fontDesc = FONT_STYLES[params.fontStyle] || FONT_STYLES['modern'];
    designLines.push(`- **Fidelidade Tipográfica:** O texto "${params.textContent}" deve ser renderizado PERFEITAMENTE, sem erros ortográficos, usando uma tipografia ${fontDesc}.`);
    
    const posLabels: Record<string, string> = {
      'top': 'no topo da imagem',
      'center': 'centralizado na imagem',
      'bottom': 'na parte inferior da imagem',
      'top-left': 'no canto superior esquerdo',
      'top-right': 'no canto superior direito',
      'bottom-left': 'no canto inferior esquerdo',
      'bottom-right': 'no canto inferior direito',
    };
    designLines.push(`- **Posição do Texto:** ${posLabels[params.textPosition] || 'centralizado'}`);
    designLines.push(`- **Legibilidade e Contraste:** Garanta que o texto seja o foco principal e seja 100% legível. Utilize espaço negativo estratégico, sobreposições de gradiente sutil ou caixas de texto limpas para separar o texto do fundo.`);
  } else {
    designLines.push(`- **SEM TEXTO:** CRÍTICO: NÃO inclua NENHUM texto, palavras, letras, números ou símbolos visíveis na imagem. A imagem deve ser puramente visual.`);
  }
  
  designLines.push(`- **Design Inteligente:** Organize os elementos visuais de acordo com o Tom de Voz "${toneStr}". O layout deve guiar o olhar naturalmente pela composição.`);

  sections.push(`### 3. INSTRUÇÕES CRUCIAIS DE DESIGN\n${designLines.join('\n')}`);

  // === 4. REFERÊNCIAS VISUAIS ===
  if (params.preserveImagesCount > 0 || params.styleReferenceImagesCount > 0) {
    const refLines: string[] = [];
    if (params.preserveImagesCount > 0) {
      refLines.push(`${params.preserveImagesCount} imagem(ns) da IDENTIDADE DA MARCA foram fornecidas. Use-as como REFERÊNCIA DE ESTILO (Style Reference): extraia a atmosfera, iluminação, paleta de cores e sentimento geral, aplicando-os à cena descrita. A nova imagem DEVE parecer parte do mesmo conjunto visual.`);
    }
    if (params.styleReferenceImagesCount > 0) {
      refLines.push(`${params.styleReferenceImagesCount} imagem(ns) de REFERÊNCIA DO USUÁRIO foram fornecidas. Use como inspiração adicional de composição e estética.`);
    }
    sections.push(`### 4. REFERÊNCIAS VISUAIS\n${refLines.join('\n')}`);
  }

  // === COMPLIANCE ===
  sections.push(`### 5. COMPLIANCE ÉTICO
DIRETRIZES ÉTICAS E LEGAIS OBRIGATÓRIAS (CONAR/CDC):
- HONESTIDADE: A imagem NÃO PODE induzir ao erro
- DIGNIDADE HUMANA: PROIBIDO discriminação
- CONCORRÊNCIA: NÃO ridicularize concorrentes
- Se político: respeitar regulamentações eleitorais`);

  // === POLITICAL CONTEXT ===
  if (params.politicalContext) {
    sections.push(params.politicalContext);
  }

  // === ADDITIONAL INFO ===
  if (params.additionalInfo) {
    sections.push(`### INFORMAÇÕES ADICIONAIS\n${params.additionalInfo}`);
  }

  return sections.join('\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
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

    // Fetch profile + political profile in parallel
    const [profileResult, politicalProfile] = await Promise.all([
      supabase.from('profiles').select('team_id, credits, name').eq('id', authenticatedUserId).single(),
      fetchPoliticalProfile(supabase, authenticatedUserId)
    ]);
    const { data: profile, error: profileError } = profileResult;

    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao carregar perfil do usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedTeamId = profile?.team_id || null;
    const userName = profile?.name || 'Usuário';

    const formData = await req.json();
    
    if (!formData.description || typeof formData.description !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Descrição inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎬 Generate Image Request (Premium Pipeline):', { 
      description: formData.description?.substring(0, 100),
      brandId: formData.brandId,
      themeId: formData.themeId,
      personaId: formData.personaId,
      vibeStyle: formData.vibeStyle,
      fontStyle: formData.fontStyle,
      platform: formData.platform,
      userId: authenticatedUserId,
    });

    // Check user credits
    const creditsCheck = await checkUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.COMPLETE_IMAGE);
    if (!creditsCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.COMPLETE_IMAGE} créditos` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const creditsBefore = creditsCheck.currentCredits;

    // =====================================
    // FETCH COMPLETE DATA FROM DB (in parallel)
    // =====================================
    const [brandData, themeData, personaData] = await Promise.all([
      formData.brandId ? fetchBrandData(supabase, formData.brandId) : null,
      formData.themeId ? fetchThemeData(supabase, formData.themeId) : null,
      formData.personaId ? fetchPersonaData(supabase, formData.personaId) : null,
    ]);

    console.log('📦 Data fetched:', {
      brand: brandData?.name || 'none',
      theme: themeData?.title || 'none', 
      persona: personaData?.name || 'none',
    });

    // =====================================
    // STEP 1: ENRICH PROMPT WITH GEMINI FLASH (LLM Refiner)
    // =====================================
    const politicalContext = buildPoliticalContext(politicalProfile);
    const politicalTone = formData.politicalTone || 'institucional';
    const { enrichedDescription, copywriting: copywritingSuggestion } = await enrichPromptWithFlash(
      formData.description,
      brandData,
      themeData,
      personaData,
      politicalContext,
      politicalTone,
      politicalProfile
    );

    // =====================================
    // STEP 2: BUILD STRUCTURED "CONSULTOR POLÍTICO" PROMPT
    // =====================================
    const tones = Array.isArray(formData.tone) ? formData.tone : (formData.tone ? [formData.tone] : []);
    const preserveImages = formData.preserveImages || [];
    const styleReferenceImages = formData.styleReferenceImages || [];

    const enhancedPrompt = buildDirectorPrompt({
      userName,
      description: formData.description,
      enrichedDescription,
      brandData,
      themeData,
      personaData,
      politicalContext,
      politicalTone,
      vibeStyle: formData.vibeStyle || formData.visualStyle || 'professional',
      fontStyle: formData.fontStyle || 'modern',
      includeText: formData.includeText ?? false,
      textContent: cleanInput(formData.textContent),
      textPosition: formData.textPosition || 'center',
      contentType: formData.contentType || 'organic',
      platform: cleanInput(formData.platform),
      objective: cleanInput(formData.objective),
      tones,
      additionalInfo: cleanInput(formData.additionalInfo),
      preserveImagesCount: preserveImages.length,
      styleReferenceImagesCount: styleReferenceImages.length,
      copywritingSuggestion,
    });

    console.log('📝 Director prompt built:', enhancedPrompt.length, 'chars');

    // =====================================
    // STEP 3: GENERATE IMAGE WITH GEMINI 3 PRO (Lovable AI Gateway)
    // =====================================
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build message content with images
    const messageContent: any[] = [
      { type: 'text', text: enhancedPrompt }
    ];
    
    // Add brand images (style reference)
    if (preserveImages.length > 0) {
      console.log(`✅ Adding ${preserveImages.length} brand identity image(s)...`);
      preserveImages.forEach((img: string, index: number) => {
        messageContent.push({
          type: 'image_url',
          image_url: { url: img }
        });
      });
    }
    
    // Add user reference images
    if (styleReferenceImages.length > 0) {
      console.log(`✅ Adding ${styleReferenceImages.length} user reference image(s)...`);
      styleReferenceImages.forEach((img: string, index: number) => {
        messageContent.push({
          type: 'image_url',
          image_url: { url: img }
        });
      });
    }

    console.log(`📦 Total message parts: ${messageContent.length} (1 text + ${messageContent.length - 1} images)`);

    // Retry logic
    const MAX_RETRIES = 3;
    let lastError: any = null;
    let imageUrl: string | null = null;
    let description = 'Imagem gerada com sucesso';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🖼️ Image generation attempt ${attempt}/${MAX_RETRIES} via Lovable AI Gateway (Gemini 3 Pro)...`);

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-pro-image-preview',
            messages: [{ role: 'user', content: messageContent }],
            modalities: ['image', 'text'],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Gateway error (attempt ${attempt}):`, response.status, errorText);
          
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: 'Créditos da plataforma esgotados. Entre em contato com o suporte.' }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          lastError = new Error(`Gateway error: ${response.status}`);
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw lastError;
        }

        const data = await response.json();
        console.log('Gateway response received');

        // Extract image from response - handle both OpenAI-style and Gemini-style responses
        if (data.choices?.[0]?.message?.content) {
          const content = data.choices[0].message.content;
          
          // If content is an array (multimodal response)
          if (Array.isArray(content)) {
            for (const part of content) {
              if (part.type === 'image_url' && part.image_url?.url) {
                imageUrl = part.image_url.url;
                console.log('Image extracted from array response');
                break;
              }
              if (part.type === 'text' && part.text) {
                description = part.text;
              }
            }
          }
          // If content is a string (text only response with inline image)
          else if (typeof content === 'string') {
            description = content;
          }
        }

        // Also check for inline_data style (Gemini native format proxied)
        if (!imageUrl && data.candidates?.[0]?.content?.parts) {
          const parts = data.candidates[0].content.parts;
          for (const part of parts) {
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              console.log('Image extracted from Gemini native format');
              break;
            }
            if (part.text) {
              description = part.text;
            }
          }
        }

        if (!imageUrl) {
          throw new Error('No image found in response');
        }

        break; // Success
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!imageUrl) {
      console.error('Failed after all retries:', lastError);
      return new Response(
        JSON.stringify({ error: 'Falha ao gerar imagem após múltiplas tentativas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================
    // UPLOAD TO STORAGE
    // =====================================
    console.log('Uploading image to storage...');
    const timestamp = Date.now();
    const fileName = `content-images/${authenticatedTeamId || authenticatedUserId}/${timestamp}.png`;
    
    // Handle both base64 and URL responses
    let binaryData: Uint8Array;
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    } else {
      // It's a URL, fetch it
      const imgResp = await fetch(imageUrl);
      const arrayBuf = await imgResp.arrayBuffer();
      binaryData = new Uint8Array(arrayBuf);
    }
    
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

    const { data: { publicUrl } } = supabase.storage
      .from('content-images')
      .getPublicUrl(fileName);

    console.log('Image uploaded successfully:', publicUrl);

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, authenticatedUserId, CREDIT_COSTS.COMPLETE_IMAGE);
    const creditsAfter = deductResult.newCredits;

    await recordUserCreditUsage(supabase, {
      userId: authenticatedUserId,
      teamId: authenticatedTeamId,
      actionType: 'COMPLETE_IMAGE',
      creditsUsed: CREDIT_COSTS.COMPLETE_IMAGE,
      creditsBefore,
      creditsAfter,
      description: 'Geração de imagem (Pipeline Premium)',
      metadata: { 
        platform: formData.platform, 
        vibeStyle: formData.vibeStyle || formData.visualStyle,
        fontStyle: formData.fontStyle,
        model: 'gemini-3-pro-image-preview',
        enriched: enrichedDescription !== formData.description,
      }
    });

    // Save to actions
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
          vibeStyle: formData.vibeStyle || formData.visualStyle,
          fontStyle: formData.fontStyle,
          contentType: formData.contentType,
          preserveImagesCount: preserveImages.length,
          styleReferenceImagesCount: styleReferenceImages.length,
          pipeline: 'premium_v2',
        },
        result: {
          imageUrl: publicUrl,
          description: description,
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
