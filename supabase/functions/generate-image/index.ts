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
const TONE_VISUAL_MAP: Record<string, {
  contrast: string;
  lighting: string;
  style: string;
  composition: string;
  focus: string;
  description: string;
  fontHint: string;
  colorHint: string;
}> = {
  combativo: {
    contrast: "Alto — contrastes fortes, sombras intensas",
    lighting: "Dramática, low-key, sombras fortes, contra-luz",
    style: "Bold, impactante, alto contraste, cores intensas",
    composition: "Dinâmica, assimétrica, composição de tensão e urgência",
    focus: "Poder, urgência, força, determinação",
    description: "Gera urgência e força. Cores intensas, tipografia impactante, contrastes fortes.",
    fontHint: "Sans-serif robusta, condensada e impactante",
    colorHint: "Vermelho intenso, preto, branco alto contraste",
  },
  didatico: {
    contrast: "Médio — contraste equilibrado e legível",
    lighting: "Uniforme, limpa, studio brilhante e neutro",
    style: "Clean/Grid, elementos infográficos, dados visuais",
    composition: "Organizada, grid-based, hierarquia clara, espaço para dados",
    focus: "Compreensão de dados, clareza, confiança, transparência",
    description: "Facilita a compreensão de dados. Layout limpo, elementos infográficos, tons neutros.",
    fontHint: "Sans-serif moderna, geométrica, alta legibilidade",
    colorHint: "Azul institucional, verde confiança, tons neutros",
  },
  emocional: {
    contrast: "Baixo-Médio — tons suaves e acolhedores",
    lighting: "Quente/Golden Hour, luz natural suave, amanhecer/pôr-do-sol",
    style: "Quente, centrado no humano, empático, acolhedor",
    composition: "Close-ups, foco humano, enquadramento íntimo, olhar direto",
    focus: "Pessoas/Expressões, conexão humana, empatia, pertencimento",
    description: "Gera conexão humana e empatia. Iluminação quente, foco em pessoas e expressões.",
    fontHint: "Serifada elegante ou script acolhedora, transmitindo humanidade",
    colorHint: "Tons quentes, âmbar, dourado, cores da terra",
  },
  institucional: {
    contrast: "Baixo — composição estável e formal",
    lighting: "Limpa, balanceada, studio profissional",
    style: "Minimalista, formal, autoritário, governamental",
    composition: "Simétrica, centrada, estável, bandeiras e símbolos",
    focus: "Ordem, estabilidade, governança, competência",
    description: "Transmite estabilidade e ordem. Estilo minimalista, composição simétrica.",
    fontHint: "Serifada clássica, autoritária, transmitindo seriedade",
    colorHint: "Azul escuro, dourado, branco, cores nacionais",
  },
};

// =====================================
// ASPECT RATIO MAP (Platform → Ratio)
// =====================================
const PLATFORM_ASPECT_RATIO: Record<string, string> = {
  'feed': '4:5',
  'stories': '9:16',
  'reels': '9:16',
  'linkedin': '1.91:1',
  'twitter': '1.91:1',
  'facebook_feed': '4:5',
  'youtube_thumb': '16:9',
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
    .select('title, description, tone_of_voice, platforms, target_audience, objectives, macro_themes, objective_type, color_palette, hashtags, expected_action, best_formats')
    .eq('id', themeId)
    .single();
  if (error) { console.error('Error fetching theme:', error); return null; }
  return data;
}

async function fetchPersonaData(supabase: any, personaId: string) {
  const { data, error } = await supabase
    .from('personas')
    .select('name, age, gender, location, professional_context, preferred_tone_of_voice, challenges, main_goal, beliefs_and_interests, interest_triggers, purchase_journey_stage')
    .eq('id', personaId)
    .single();
  if (error) { console.error('Error fetching persona:', error); return null; }
  return data;
}

// =====================================
// STEP 1: LLM REFINER - BRIEFING VISUAL + COPYWRITING (Gemini Flash)
// =====================================
async function enrichPromptWithFlash(
  rawDescription: string,
  brandData: any,
  themeData: any,
  personaData: any,
  politicalContext: string,
  politicalTone: string,
  politicalProfile: any,
  params?: { textContent?: string; headline?: string; promptContext?: string }
): Promise<{ enrichedDescription: string; briefingVisual: string; headline: string; subtexto: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.warn('LOVABLE_API_KEY not found, skipping enrichment');
    return { enrichedDescription: rawDescription, briefingVisual: '', headline: '', subtexto: '' };
  }

  const toneParams = TONE_VISUAL_MAP[politicalTone] || TONE_VISUAL_MAP['institucional'];

  // Build rich context from all data sources
  const contextParts: string[] = [];
  
  if (brandData) {
    contextParts.push(`MARCA: "${brandData.name}" | Segmento: ${brandData.segment || 'N/A'} | Valores: ${brandData.values || 'N/A'} | Promessa: ${brandData.promise || 'N/A'} | Keywords: ${brandData.keywords || 'N/A'}`);
    const colors: string[] = [];
    if (brandData.brand_color) colors.push(brandData.brand_color);
    if (brandData.color_palette && Array.isArray(brandData.color_palette)) {
      brandData.color_palette.forEach((c: any) => { if (c.hex) colors.push(c.hex); });
    }
    if (colors.length > 0) contextParts.push(`Paleta: ${colors.join(', ')}`);
  }
  
  if (themeData) {
    contextParts.push(`PAUTA: "${themeData.title}" | Objetivos: ${themeData.objectives || 'N/A'} | Macro-temas: ${themeData.macro_themes || 'N/A'} | Tom: ${themeData.tone_of_voice || 'N/A'} | Audiência: ${themeData.target_audience || 'N/A'} | Ação esperada: ${themeData.expected_action || 'N/A'}`);
  }
  
  if (personaData) {
    contextParts.push(`PERSONA: "${personaData.name}" | ${personaData.age || '?'} anos, ${personaData.gender || '?'}, ${personaData.location || '?'} | Contexto: ${personaData.professional_context || 'N/A'} | Desafios: ${personaData.challenges || 'N/A'} | Objetivo: ${personaData.main_goal || 'N/A'} | Gatilhos: ${personaData.interest_triggers || 'N/A'}`);
  }
  
  if (politicalProfile) {
    const polParts: string[] = [];
    if (politicalProfile.political_role) polParts.push(`Cargo: ${politicalProfile.political_role}`);
    if (politicalProfile.political_level) polParts.push(`Nível: ${politicalProfile.political_level}`);
    if (politicalProfile.state) polParts.push(`Estado: ${politicalProfile.state}`);
    if (politicalProfile.city) polParts.push(`Cidade: ${politicalProfile.city}`);
    if (politicalProfile.mandate_stage) polParts.push(`Fase: ${politicalProfile.mandate_stage}`);
    if (politicalProfile.political_party) polParts.push(`Partido: ${politicalProfile.political_party}`);
    if (politicalProfile.focus_areas?.length) polParts.push(`Foco: ${politicalProfile.focus_areas.join(', ')}`);
    if (politicalProfile.tone_of_voice) polParts.push(`Tom pessoal: ${politicalProfile.tone_of_voice}`);
    if (polParts.length > 0) contextParts.push(`PERFIL POLÍTICO: ${polParts.join(' | ')}`);
  }

  const pp = politicalProfile || {};
  const cargo = pp.political_role || 'Político(a)';
  const estado = pp.state || pp.city || 'Brasil';
  const objetivo = themeData?.objectives || 'comunicação política';
  const mensagemCentral = params?.textContent || params?.headline || '';
  const tom = politicalTone || 'institucional';
  const grau = (politicalTone === 'combativo') ? 'Alto' : (politicalTone === 'emocional' ? 'Médio' : 'Baixo/Propositivo');
  const publicoAlvo = personaData?.name || themeData?.target_audience || 'público geral';
  const fontStyleHint = toneParams.fontHint || 'sans-serif moderna';

  const systemPrompt = `Você é um Estrategista de Marketing Político Sênior. Sua tarefa é transformar dados brutos de um formulário em um BRIEFING VISUAL detalhado para um gerador de imagens de IA (Nano Banana Pro).

DADOS DO FORMULÁRIO:
- Cargo/Local: ${cargo} em ${estado}
- Objetivo: ${objetivo}
- Mensagem Central: "${mensagemCentral}"
- Descrição Visual Bruta: (será fornecida pelo usuário)
- Tom/Combatividade: ${tom} / ${grau}
- Público-Alvo: ${publicoAlvo}

## DADOS CONTEXTUAIS COMPLETOS:
${contextParts.join('\n')}
${politicalContext ? `\nCONTEXTO POLÍTICO COMPLETO:\n${politicalContext.substring(0, 800)}` : ''}

## PARÂMETROS VISUAIS DO TOM "${tom.toUpperCase()}":
- Iluminação: ${toneParams.lighting}
- Composição: ${toneParams.composition}
- Contraste: ${toneParams.contrast}
- Foco visual: ${toneParams.focus}
- Estilo: ${toneParams.style}
- Hint tipográfico: ${fontStyleHint}
- ${toneParams.description}

SUA MISSÃO (3 etapas obrigatórias):

1. **EXPANDIR A CENA**: Transforme a "Descrição Visual Bruta" numa cena cinematográfica. Descreva:
   - Lente da câmera (ex: 35mm para contexto ambiental, 85mm para retrato)
   - Iluminação específica (${grau === 'Alto' ? 'sombras profundas, contra-luz dramático, low-key' : 'luz solar suave, golden hour, tons abertos e acolhedores'})
   - Cores dominantes alinhadas à paleta da marca
   - Expressão facial e linguagem corporal do político alinhados ao tom "${tom}"
   - Elementos regionais sutis de ${estado} (arquitetura, vegetação, cultura local)
   - Profundidade de campo, texturas e materiais

2. **DEFINIR O LAYOUT DO TEXTO**: Se houver mensagem central "${mensagemCentral}", defina:
   - Posição exata para impacto máximo (ex: "caixa alta, alinhado à direita sobre área de respiro")
   - Estilo tipográfico: ${fontStyleHint}
   - Hierarquia visual adequada ao público ${publicoAlvo}
   - Garantia de legibilidade absoluta (contraste texto/fundo)

3. **AJUSTAR O CLIMA**: Adapte toda a atmosfera:
   ${grau === 'Alto' ? '- Sombras profundas, cores fortes e saturadas, contraste dramático, energia de urgência' : grau === 'Médio' ? '- Luz quente dourada, foco em expressões humanas, empatia e conexão' : '- Luz solar suave, tons abertos e limpos, estabilidade e confiança'}

## VALIDAÇÃO ÉTICA (pré-verificação):
- Se houver menção a "inimigo" ou "adversário", transforme em "crítica política legítima"
- Nunca gerar conteúdo que viole dignidade humana ou incite ódio
- Respeitar regulamentações eleitorais (TSE)

## FORMATO DE RESPOSTA (JSON estrito):
{
  "briefing_visual": "Uma fotografia cinematográfica de [CENA DETALHADA]. Lente [LENTE]. Iluminação [DETALHES]. O clima deve ser [ATMOSFERA DETALHADA]. Cores [PALETA]. O político demonstra [EXPRESSÃO/POSTURA]. Elementos de ${estado} incluem [DETALHES REGIONAIS]. O texto '[TEXTO]' deve ser renderizado com fonte ${fontStyleHint} na posição [POSIÇÃO IDEAL], garantindo legibilidade absoluta e hierarquia visual para o público de ${publicoAlvo}.",
  "headline": "texto principal sugerido (máx 10 palavras)",
  "subtexto": "CTA ou texto secundário (máx 15 palavras)"
}

REGRAS:
- Máximo 300 palavras no briefing_visual
- Sempre em português
- Seja EXTREMAMENTE específico e visual, nunca genérico
- Cada elemento deve ter uma razão estratégica ligada ao objetivo "${objetivo}"`;

  // pp already defined above

  try {
    console.log('🎨 Step 1: LLM Refiner — Estrategista de Marketing Político...');
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
          { role: 'user', content: `Transforme esta Descrição Visual Bruta num Briefing Visual cinematográfico completo:\n\n"${rawDescription}"\n\n${params?.promptContext ? `CONTEXTO CONSOLIDADO DO FORMULÁRIO:\n${params.promptContext}` : ''}` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error(`Flash enrichment failed with status ${status}`);
      if (status === 429) console.warn('Rate limited on enrichment, using original');
      if (status === 402) console.warn('Payment required on enrichment, using original');
      return { enrichedDescription: rawDescription, briefingVisual: '', headline: '', subtexto: '' };
    }

    const data = await response.json();
    const enriched = data.choices?.[0]?.message?.content?.trim();
    if (enriched && enriched.length > 20) {
      console.log(`✅ LLM Refiner output: ${enriched.length} chars`);
      
      try {
        const jsonMatch = enriched.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            enrichedDescription: parsed.briefing_visual || rawDescription,
            briefingVisual: parsed.briefing_visual || '',
            headline: parsed.headline || '',
            subtexto: parsed.subtexto || '',
          };
        }
      } catch (parseErr) {
        console.warn('Could not parse enrichment as JSON, using raw text');
      }
      
      return { enrichedDescription: enriched, briefingVisual: '', headline: '', subtexto: '' };
    }
    return { enrichedDescription: rawDescription, briefingVisual: '', headline: '', subtexto: '' };
  } catch (error) {
    console.error('Error in LLM Refiner:', error);
    return { enrichedDescription: rawDescription, briefingVisual: '', headline: '', subtexto: '' };
  }
}

// =====================================
// STEP 2: BUILD POLITICAL MASTER PROMPT (Nano Banana Pro)
// =====================================
function buildDirectorPrompt(params: {
  userName: string;
  description: string;
  enrichedDescription: string;
  brandData: any;
  themeData: any;
  personaData: any;
  politicalContext: string;
  politicalProfile: any;
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
  headline: string;
  subtexto: string;
}): string {
  const sections: string[] = [];
  const toneParams = TONE_VISUAL_MAP[params.politicalTone] || TONE_VISUAL_MAP['institucional'];
  const pp = params.politicalProfile || {};

  // === ROLE ===
  sections.push(`Atue como um Consultor de Marketing Político e Designer de Campanha de Alto Nível. O seu objetivo é criar uma peça visual impecável, esteticamente perfeita e com design inteligente para ${params.userName}, respeitando rigorosamente a identidade visual e os dados fornecidos abaixo.`);

  // === 1. CONTEXTO DO UTILIZADOR E MARCA ===
  const contextLines: string[] = [];
  
  if (pp.political_role || pp.state) {
    contextLines.push(`- **Cargo/Função:** ${pp.political_role || 'Político(a)'} em ${pp.state || 'Brasil'}`);
  }
  if (pp.political_party) contextLines.push(`- **Partido:** ${pp.political_party}`);
  if (pp.mandate_stage) contextLines.push(`- **Fase da Campanha/Mandato:** ${pp.mandate_stage}`);
  if (pp.focus_areas?.length) contextLines.push(`- **Áreas de Foco:** ${pp.focus_areas.join(', ')}`);

  if (params.brandData) {
    contextLines.push(`- **Marca:** ${params.brandData.name}`);
    if (params.brandData.segment) contextLines.push(`- **Setor/Nicho:** ${params.brandData.segment}`);
    if (params.brandData.values) contextLines.push(`- **Valores:** ${params.brandData.values}`);
    if (params.brandData.keywords) contextLines.push(`- **Keywords:** ${params.brandData.keywords}`);
    if (params.brandData.promise) contextLines.push(`- **Promessa da Marca:** ${params.brandData.promise}`);
    if (params.brandData.goals) contextLines.push(`- **Objetivos:** ${params.brandData.goals}`);
    
    const colors: string[] = [];
    if (params.brandData.brand_color) colors.push(params.brandData.brand_color);
    if (params.brandData.color_palette && Array.isArray(params.brandData.color_palette)) {
      params.brandData.color_palette.forEach((c: any) => { if (c.hex) colors.push(c.hex); });
    }
    if (colors.length > 0) {
      contextLines.push(`- **Paleta de Cores Obrigatória:** ${colors.join(', ')}. Se imagens de referência forem fornecidas, extraia a paleta exata delas.`);
    }
    if (params.brandData.restrictions) contextLines.push(`- **Restrições:** ${params.brandData.restrictions}`);
  }
  
  if (params.personaData) {
    contextLines.push(`- **Público-Alvo:** ${params.personaData.name}`);
    const personaDetails: string[] = [];
    if (params.personaData.age) personaDetails.push(`${params.personaData.age} anos`);
    if (params.personaData.gender) personaDetails.push(params.personaData.gender);
    if (params.personaData.location) personaDetails.push(params.personaData.location);
    if (params.personaData.professional_context) personaDetails.push(params.personaData.professional_context);
    if (personaDetails.length > 0) contextLines.push(`- **Perfil da Audiência:** ${personaDetails.join(', ')}`);
    if (params.personaData.challenges) contextLines.push(`- **Desafios da Audiência:** ${params.personaData.challenges}`);
    if (params.personaData.main_goal) contextLines.push(`- **Objetivo da Audiência:** ${params.personaData.main_goal}`);
    if (params.personaData.beliefs_and_interests) contextLines.push(`- **Crenças e Interesses:** ${params.personaData.beliefs_and_interests}`);
    if (params.personaData.interest_triggers) contextLines.push(`- **Gatilhos de Interesse:** ${params.personaData.interest_triggers}`);
  }

  // Tom de voz
  const toneStr = params.tones.length > 0 ? params.tones.join(', ') : 
    (params.themeData?.tone_of_voice || params.personaData?.preferred_tone_of_voice || pp.tone_of_voice || 'profissional');
  contextLines.push(`- **Tom de Voz da Marca:** ${toneStr}`);

  if (contextLines.length > 0) {
    sections.push(`### 1. CONTEXTO DO UTILIZADOR E MARCA (Dados Dinâmicos)\n${contextLines.join('\n')}`);
  }

  // === 2. DIRETRIZES ESTRATÉGICAS ===
  const stratLines: string[] = [];
  
  if (pp.mandate_stage) stratLines.push(`- **Fase:** ${pp.mandate_stage} — Adaptar o semblante e maturidade visual para esta fase.`);
  if (params.objective) stratLines.push(`- **Objetivo do Post:** ${params.objective}`);
  if (params.personaData?.name) stratLines.push(`- **Público-Alvo:** ${params.personaData.name} — O design deve ressoar com este grupo específico.`);
  
  stratLines.push(`- **Grau de Combatividade:** ${params.politicalTone === 'combativo' ? 'Alto' : params.politicalTone === 'emocional' ? 'Baixo/Propositivo' : 'Médio'}`);
  
  if (params.politicalTone === 'combativo') {
    stratLines.push(`  → Use contrastes fortes, cores intensas e tipografia impactante.`);
  } else if (params.politicalTone === 'emocional') {
    stratLines.push(`  → Use tons mais suaves, iluminação aberta e design acolhedor.`);
  } else if (params.politicalTone === 'didatico') {
    stratLines.push(`  → Use layout limpo/grid, elementos infográficos, iluminação uniforme.`);
  } else {
    stratLines.push(`  → Use composição simétrica, estilo minimalista, transmitindo estabilidade.`);
  }

  if (params.themeData) {
    if (params.themeData.title) stratLines.push(`- **Tema Estratégico:** ${params.themeData.title}`);
    if (params.themeData.objectives) stratLines.push(`- **Objetivos da Pauta:** ${params.themeData.objectives}`);
    if (params.themeData.macro_themes) stratLines.push(`- **Macro-temas:** ${params.themeData.macro_themes}`);
    if (params.themeData.target_audience) stratLines.push(`- **Público da Pauta:** ${params.themeData.target_audience}`);
    if (params.themeData.expected_action) stratLines.push(`- **Ação Esperada:** ${params.themeData.expected_action}`);
    if (params.themeData.hashtags) stratLines.push(`- **Hashtags:** ${params.themeData.hashtags}`);
  }

  if (stratLines.length > 0) {
    sections.push(`### 2. DIRETRIZES ESTRATÉGICAS\n${stratLines.join('\n')}`);
  }

  // === 3. COMPOSIÇÃO DA IMAGEM (NANO BANANA PRO) ===
  const compositionLines: string[] = [];
  
  compositionLines.push(`- **Cena:** ${params.enrichedDescription}. O político deve demonstrar um semblante ${toneStr} através da linguagem corporal e expressão facial.`);

  // Brand identity
  const colors: string[] = [];
  if (params.brandData?.brand_color) colors.push(params.brandData.brand_color);
  if (params.brandData?.color_palette && Array.isArray(params.brandData.color_palette)) {
    params.brandData.color_palette.forEach((c: any) => { if (c.hex) colors.push(c.hex); });
  }
  if (colors.length > 0) {
    compositionLines.push(`- **Identidade:** Aplique as cores ${colors.join(', ')} na composição.`);
  }

  // Visual style (Vibe)
  const vibeDesc = VIBE_STYLES[params.vibeStyle] || VIBE_STYLES['professional'] || params.vibeStyle;
  compositionLines.push(`- **Estilo Visual:** ${vibeDesc}`);
  
  // Lighting based on tone
  compositionLines.push(`- **Iluminação:** ${toneParams.lighting}`);
  compositionLines.push(`- **Composição:** ${toneParams.composition}`);
  compositionLines.push(`- **Contraste:** ${toneParams.contrast}`);
  compositionLines.push(`- **Foco Visual:** ${toneParams.focus}`);

  // Platform
  if (params.platform) compositionLines.push(`- **Plataforma:** ${params.platform}`);
  if (params.contentType === 'ads') {
    compositionLines.push(`- **Tipo:** Conteúdo de ANÚNCIO PAGO — foco em conversão, CTA implícito`);
  } else {
    compositionLines.push(`- **Tipo:** Conteúdo ORGÂNICO — foco em engajamento, autenticidade, conexão`);
  }

  // Regional adaptation
  if (pp.state) {
    compositionLines.push(`- **Regionalismo:** Adapte sutilmente o fundo da imagem (arquitetura, vegetação, elementos culturais) para remeter a ${pp.state}${pp.city ? ` / ${pp.city}` : ''}.`);
  }

  // Qualidade
  compositionLines.push(`- **Qualidade:** Fotorealismo 4K, profundidade de campo profissional, estilo de fotografia de campanha de alta verba.`);

  sections.push(`### 3. COMPOSIÇÃO DA IMAGEM (NANO BANANA PRO)\n${compositionLines.join('\n')}`);

  // === 4. TEXTO E DESIGN ===
  const textLines: string[] = [];
  
  if (params.includeText && params.textContent?.trim()) {
    const headlineText = params.textContent;
    
    // Font based on political tone + user selection
    const userFont = FONT_STYLES[params.fontStyle] || FONT_STYLES['modern'];
    const toneFont = toneParams.fontHint;
    
    textLines.push(`- **Headline (Texto Principal na Imagem):** Renderize PERFEITAMENTE o texto: "${headlineText}"`);
    textLines.push(`- **Tipografia:** ${userFont}. Adaptar ao tom político: ${toneFont}.`);
    textLines.push(`- **Cor da tipografia:** Em harmonia com a paleta da marca${pp.state ? ` e cores que remetam a ${pp.state}` : ''}.`);
    
    const posLabels: Record<string, string> = {
      'top': 'no topo da imagem',
      'center': 'centralizado na imagem',
      'bottom': 'na parte inferior da imagem',
      'top-left': 'no canto superior esquerdo',
      'top-right': 'no canto superior direito',
      'bottom-left': 'no canto inferior esquerdo',
      'bottom-right': 'no canto inferior direito',
    };
    textLines.push(`- **Posição do Texto:** ${posLabels[params.textPosition] || 'centralizado'}. O texto NÃO deve obstruir o rosto do candidato.`);
    textLines.push(`- **Legibilidade e Contraste:** O texto DEVE ser o foco principal e ser 100% legível. Utilize espaço negativo estratégico, sobreposições de gradiente sutil ou caixas de texto limpas. O texto deve fazer parte da composição, não flutuar sem propósito.`);
  } else {
    // Use LLM Refiner suggestions if available
    if (params.headline) {
      textLines.push(`- **Headline Sugerida (renderizar se apropriado):** "${params.headline}"`);
      if (params.subtexto) textLines.push(`- **Subtexto/CTA Sugerido:** "${params.subtexto}"`);
      textLines.push(`- **NOTA:** Renderize o texto apenas se fizer sentido para o layout. Se não, crie uma imagem puramente visual.`);
    } else {
      textLines.push(`- **SEM TEXTO:** CRÍTICO: NÃO inclua NENHUM texto, palavras, letras, números ou símbolos visíveis na imagem. A imagem deve ser puramente visual.`);
    }
  }
  
  textLines.push(`- **Design Inteligente:** Organize os elementos visuais de acordo com o Tom "${toneStr}". ${params.politicalTone === 'combativo' ? 'Use muito contraste e composições dinâmicas.' : params.politicalTone === 'emocional' ? 'Use iluminação quente e composições íntimas.' : params.politicalTone === 'didatico' ? 'Use layout grid e espaço para informação.' : 'Use composição simétrica e muito espaço em branco.'} O layout deve guiar o olhar para o elemento principal.`);

  sections.push(`### 4. TEXTO E DESIGN\n${textLines.join('\n')}`);

  // === 5. REFERÊNCIAS VISUAIS ===
  if (params.preserveImagesCount > 0 || params.styleReferenceImagesCount > 0) {
    const refLines: string[] = [];
    if (params.preserveImagesCount > 0) {
      refLines.push(`${params.preserveImagesCount} imagem(ns) da IDENTIDADE DA MARCA foram fornecidas. Use como REFERÊNCIA DE ESTILO (Style Reference): extraia a atmosfera, iluminação, paleta de cores e sentimento geral. A nova imagem DEVE parecer parte do mesmo conjunto visual. Não replique as imagens, use-as como inspiração estética.`);
    }
    if (params.styleReferenceImagesCount > 0) {
      refLines.push(`${params.styleReferenceImagesCount} imagem(ns) de REFERÊNCIA DO USUÁRIO foram fornecidas. Use como inspiração adicional de composição e estética.`);
    }
    sections.push(`### 5. USO DE REFERÊNCIAS VISUAIS\n${refLines.join('\n')}`);
  }

  // === 6. COMPLIANCE E ESPECIFICAÇÕES ===
  sections.push(`### 6. ESPECIFICAÇÕES TÉCNICAS E COMPLIANCE
- **Formato:** ${params.platform ? `Otimizado para ${params.platform}` : 'Formato universal'}
- **Resolução:** 4K, PNG para tipografia nítida
- **Geração de Pessoas:** Permitida — campanha política requer representação humana

COMPLIANCE ÉTICO E LEGAL (CONAR/CDC/TSE):
- HONESTIDADE: A imagem NÃO pode induzir ao erro ou criar falsas representações
- DIGNIDADE: PROIBIDO qualquer forma de discriminação ou discurso de ódio
- REGULAMENTAÇÃO ELEITORAL: Respeitar legislação vigente
- ACESSIBILIDADE: Garantir contraste mínimo WCAG AA para textos`);

  // === POLITICAL CONTEXT ===
  if (params.politicalContext) {
    sections.push(params.politicalContext);
  }

  // === ADDITIONAL INFO ===
  if (params.additionalInfo) {
    sections.push(`### INFORMAÇÕES ADICIONAIS DO USUÁRIO\n${params.additionalInfo}`);
  }

  return sections.join('\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      supabase.from('profiles').select('team_id, credits, name, state, city').eq('id', authenticatedUserId).single(),
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
    
    // Merge profile location into political profile
    const fullPoliticalProfile = {
      ...politicalProfile,
      state: politicalProfile?.state || profile?.state,
      city: politicalProfile?.city || profile?.city,
    };

    const formData = await req.json();
    
    if (!formData.description || typeof formData.description !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Descrição inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎬 Generate Image Request (Premium Political Pipeline):', { 
      description: formData.description?.substring(0, 100),
      brandId: formData.brandId,
      themeId: formData.themeId,
      personaId: formData.personaId,
      vibeStyle: formData.vibeStyle,
      fontStyle: formData.fontStyle,
      politicalTone: formData.politicalTone,
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
      politicalRole: fullPoliticalProfile?.political_role || 'none',
    });

    // =====================================
    // STEP 1: LLM REFINER (Gemini Flash) — Briefing Visual + Copywriting
    // =====================================
    const politicalContext = buildPoliticalContext(politicalProfile);
    const politicalTone = formData.politicalTone || 'institucional';
    const { enrichedDescription, headline, subtexto } = await enrichPromptWithFlash(
      formData.description,
      brandData,
      themeData,
      personaData,
      politicalContext,
      politicalTone,
      fullPoliticalProfile,
      {
        textContent: formData.textContent,
        headline: formData.headline,
        promptContext: formData.promptContext,
      }
    );

    // =====================================
    // STEP 2: BUILD STRUCTURED POLITICAL MASTER PROMPT
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
      politicalProfile: fullPoliticalProfile,
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
      headline,
      subtexto,
    });

    console.log('📝 Political Master Prompt built:', enhancedPrompt.length, 'chars');

    // =====================================
    // STEP 3: GENERATE IMAGE WITH GEMINI 3 PRO (Nano Banana Pro)
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
      console.log(`✅ Adding ${preserveImages.length} brand identity image(s) as style_reference...`);
      preserveImages.forEach((img: string) => {
        messageContent.push({
          type: 'image_url',
          image_url: { url: img }
        });
      });
    }
    
    // Add user reference images
    if (styleReferenceImages.length > 0) {
      console.log(`✅ Adding ${styleReferenceImages.length} user reference image(s)...`);
      styleReferenceImages.forEach((img: string) => {
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
        console.log(`🖼️ Image generation attempt ${attempt}/${MAX_RETRIES} via Nano Banana Pro (Gemini 3 Pro)...`);

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

        // Extract image - check the `images` field first (Lovable AI Gateway format)
        const message = data.choices?.[0]?.message;
        if (message?.images?.length > 0) {
          const img = message.images[0];
          if (img?.image_url?.url) {
            imageUrl = img.image_url.url;
            console.log('Image extracted from message.images[]');
          }
          if (message.content && typeof message.content === 'string') {
            description = message.content;
          }
        }

        // Fallback: check content array format
        if (!imageUrl && message?.content) {
          const content = message.content;
          if (Array.isArray(content)) {
            for (const part of content) {
              if (part.type === 'image_url' && part.image_url?.url) {
                imageUrl = part.image_url.url;
                console.log('Image extracted from content array');
                break;
              }
              if (part.type === 'text' && part.text) {
                description = part.text;
              }
            }
          } else if (typeof content === 'string') {
            description = content;
          }
        }

        // Fallback: inline_data style (Gemini native format)
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
          console.error('Response structure:', JSON.stringify(Object.keys(data)), JSON.stringify(Object.keys(message || {})));
          throw new Error('No image found in response');
        }

        break;
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
    
    let binaryData: Uint8Array;
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    } else {
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
      description: 'Geração de imagem (Pipeline Político Premium)',
      metadata: { 
        platform: formData.platform, 
        vibeStyle: formData.vibeStyle || formData.visualStyle,
        fontStyle: formData.fontStyle,
        politicalTone: formData.politicalTone,
        model: 'gemini-3-pro-image-preview',
        enriched: enrichedDescription !== formData.description,
        hasHeadline: !!headline,
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
          politicalTone: formData.politicalTone,
          contentType: formData.contentType,
          preserveImagesCount: preserveImages.length,
          styleReferenceImagesCount: styleReferenceImages.length,
          pipeline: 'political_premium_v3',
        },
        result: {
          imageUrl: publicUrl,
          description: description,
          headline: headline || null,
          subtexto: subtexto || null,
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
        headline: headline || null,
        subtexto: subtexto || null,
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
