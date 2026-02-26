/**
 * buildImagePrompt.ts
 * 
 * Função auxiliar que concatena todos os campos do formulário de criação
 * de imagem numa única string de prompt estruturada. 
 * 
 * Cada seção tem um "peso" (prioridade) que pode ser ajustado facilmente.
 * O backend recebe esta string como contexto adicional junto dos IDs
 * (brandId, themeId, personaId) para buscar dados completos.
 */

// =====================================
// VIBE DESCRIPTIONS (mapeamento label → instrução visual)
// =====================================
const VIBE_DESCRIPTIONS: Record<string, string> = {
  minimalist: "Fotografia flat lay, fundo limpo, espaço negativo amplo",
  pop_neon: "Cores saturadas, iluminação neon, contraste forte",
  professional: "Fotografia corporativa, profundidade de campo rasa, tons neutros",
  cinematic: "Fotografia cinematográfica 4K, grading de filme",
  "3d_modern": "3D render minimalista, iluminação studio",
  illustration: "Ilustração vetorial moderna, cores vibrantes",
  realistic: "Fotografia hiper-realista, 8K, iluminação natural",
  animated: "3D animado estilo Pixar, renderização estilizada",
  cartoon: "Ilustração cartoon, contornos marcados, cores planas",
  anime: "Estilo anime japonês, cel-shading",
  watercolor: "Estilo aquarela, pinceladas suaves",
  oil_painting: "Pintura a óleo, texturas ricas",
  digital_art: "Arte digital profissional, conceito art",
  sketch: "Desenho a lápis, linhas expressivas",
  vintage: "Estética vintage retrô, grain de filme, tons quentes",
};

// =====================================
// FONT DESCRIPTIONS
// =====================================
const FONT_DESCRIPTIONS: Record<string, string> = {
  elegant: "serifa clássica, refinada",
  modern: "sans-serif limpa, geométrica",
  fun: "script casual ou display arrojada",
  impactful: "bold condensada, display forte",
};

// =====================================
// POLITICAL TONE → Instrução de estilo condensada
// =====================================
const TONE_INSTRUCTIONS: Record<string, string> = {
  combativo: "Contraste alto, iluminação dramática, tipografia impactante, cores intensas. Gera urgência e força.",
  didatico: "Layout grid/clean, elementos infográficos, iluminação uniforme. Facilita compreensão de dados.",
  emocional: "Iluminação golden hour, foco em pessoas/expressões, tons quentes. Gera conexão humana.",
  institucional: "Composição simétrica, minimalista, formal. Transmite estabilidade e ordem.",
};

// =====================================
// TIPOS
// =====================================
export interface PromptFormFields {
  // Seleções de entidade (enviados como IDs ao backend)
  brandId: string;
  brandName: string;
  themeId: string;
  themeName: string;
  personaId: string;
  personaName: string;

  // Campos do formulário
  objective: string;
  description: string;
  platform: string;
  contentType: 'organic' | 'ads';
  tones: string[];
  additionalInfo: string;

  // Estilos visuais
  vibeStyle: string;
  fontStyle: string;
  politicalTone: string;

  // Texto na imagem
  includeText: boolean;
  textContent: string;
  textPosition: string;

  // Avançado (opcionais)
  negativePrompt?: string;
  colorPalette?: string;
  lighting?: string;
  composition?: string;
  cameraAngle?: string;
  detailLevel?: number;
  mood?: string;

  // Contadores de imagem
  brandImagesCount: number;
  userImagesCount: number;
}

/**
 * Concatena todos os campos do formulário numa string de prompt estruturada.
 * Cada seção é marcada com ### para facilitar parsing e ajuste de pesos.
 * 
 * Esta string é enviada ao backend como `promptContext` junto dos IDs,
 * servindo como guia consolidado para o LLM Refiner e o gerador de imagem.
 */
export function buildImagePromptString(fields: PromptFormFields): string {
  const sections: string[] = [];

  // === SEÇÃO 1: IDENTIDADE (peso: alto) ===
  const identityParts: string[] = [];
  if (fields.brandName) identityParts.push(`Marca: ${fields.brandName}`);
  if (fields.themeName) identityParts.push(`Pauta: ${fields.themeName}`);
  if (fields.personaName) identityParts.push(`Persona: ${fields.personaName}`);
  if (identityParts.length > 0) {
    sections.push(`### IDENTIDADE\n${identityParts.join(' | ')}`);
  }

  // === SEÇÃO 2: OBJETIVO E CONTEXTO (peso: alto) ===
  const contextParts: string[] = [];
  if (fields.objective) contextParts.push(`Objetivo: ${fields.objective}`);
  if (fields.platform) contextParts.push(`Plataforma: ${fields.platform}`);
  if (fields.contentType) contextParts.push(`Tipo: ${fields.contentType === 'ads' ? 'Anúncio pago' : 'Orgânico'}`);
  if (fields.tones.length > 0) contextParts.push(`Tom de voz: ${fields.tones.join(', ')}`);
  if (contextParts.length > 0) {
    sections.push(`### OBJETIVO E CONTEXTO\n${contextParts.join('\n')}`);
  }

  // === SEÇÃO 3: DESCRIÇÃO VISUAL (peso: crítico) ===
  if (fields.description) {
    sections.push(`### DESCRIÇÃO VISUAL\n${fields.description}`);
  }

  // === SEÇÃO 4: ESTILO E VIBE (peso: alto) ===
  const styleParts: string[] = [];
  const vibeDesc = VIBE_DESCRIPTIONS[fields.vibeStyle];
  if (vibeDesc) styleParts.push(`Vibe: ${vibeDesc}`);
  
  const toneInstr = TONE_INSTRUCTIONS[fields.politicalTone];
  if (toneInstr) styleParts.push(`Tom político: ${fields.politicalTone} — ${toneInstr}`);
  
  if (styleParts.length > 0) {
    sections.push(`### ESTILO VISUAL\n${styleParts.join('\n')}`);
  }

  // === SEÇÃO 5: TIPOGRAFIA (peso: médio, condicional) ===
  if (fields.includeText && fields.textContent) {
    const fontDesc = FONT_DESCRIPTIONS[fields.fontStyle] || fields.fontStyle;
    const typoParts = [
      `Texto: "${fields.textContent}"`,
      `Posição: ${fields.textPosition}`,
      `Tipografia: ${fontDesc}`,
    ];
    sections.push(`### TEXTO NA IMAGEM\n${typoParts.join('\n')}`);
  }

  // === SEÇÃO 6: PARÂMETROS AVANÇADOS (peso: baixo) ===
  const advancedParts: string[] = [];
  if (fields.negativePrompt) advancedParts.push(`Evitar: ${fields.negativePrompt}`);
  if (fields.colorPalette && fields.colorPalette !== 'auto') advancedParts.push(`Paleta: ${fields.colorPalette}`);
  if (fields.lighting && fields.lighting !== 'natural') advancedParts.push(`Iluminação: ${fields.lighting}`);
  if (fields.composition && fields.composition !== 'auto') advancedParts.push(`Composição: ${fields.composition}`);
  if (fields.cameraAngle && fields.cameraAngle !== 'eye_level') advancedParts.push(`Ângulo: ${fields.cameraAngle}`);
  if (fields.mood && fields.mood !== 'auto') advancedParts.push(`Mood: ${fields.mood}`);
  if (fields.detailLevel && fields.detailLevel !== 7) advancedParts.push(`Detalhe: ${fields.detailLevel}/10`);
  if (advancedParts.length > 0) {
    sections.push(`### PARÂMETROS AVANÇADOS\n${advancedParts.join('\n')}`);
  }

  // === SEÇÃO 7: INFO ADICIONAL (peso: baixo) ===
  if (fields.additionalInfo) {
    sections.push(`### INFORMAÇÕES ADICIONAIS\n${fields.additionalInfo}`);
  }

  // === SEÇÃO 8: REFERÊNCIAS DE IMAGEM (peso: contexto) ===
  if (fields.brandImagesCount > 0 || fields.userImagesCount > 0) {
    sections.push(`### REFERÊNCIAS VISUAIS\n${fields.brandImagesCount} imagem(ns) da marca + ${fields.userImagesCount} imagem(ns) do usuário anexadas como referência.`);
  }

  return sections.join('\n\n');
}

/**
 * Monta o payload completo para enviar ao backend generate-image.
 * Usa buildImagePromptString internamente para gerar o promptContext.
 */
export function buildRequestPayload(
  fields: PromptFormFields,
  extras: {
    preserveImages: string[];
    styleReferenceImages: string[];
    teamId: string;
    width?: string;
    height?: string;
  }
) {
  const promptContext = buildImagePromptString(fields);

  return {
    // IDs para o backend buscar dados completos
    brandId: fields.brandId,
    themeId: fields.themeId,
    personaId: fields.personaId,

    // Nomes (fallback/display)
    brand: fields.brandName,
    theme: fields.themeName,
    persona: fields.personaName,

    // Prompt consolidado
    promptContext,

    // Campos individuais (o backend usa diretamente)
    objective: fields.objective,
    description: fields.description,
    tone: fields.tones,
    platform: fields.platform,
    contentType: fields.contentType,
    visualStyle: fields.vibeStyle,
    vibeStyle: fields.vibeStyle,
    fontStyle: fields.fontStyle,
    politicalTone: fields.politicalTone,
    additionalInfo: fields.additionalInfo,
    includeText: fields.includeText,
    textContent: fields.textContent,
    textPosition: fields.textPosition,
    negativePrompt: fields.negativePrompt,
    colorPalette: fields.colorPalette,
    lighting: fields.lighting,
    composition: fields.composition,
    cameraAngle: fields.cameraAngle,
    detailLevel: fields.detailLevel,
    mood: fields.mood,

    // Imagens
    preserveImages: extras.preserveImages,
    styleReferenceImages: extras.styleReferenceImages,
    brandImagesCount: extras.preserveImages.length,
    userImagesCount: extras.styleReferenceImages.length,

    // Dimensões e equipa
    width: extras.width,
    height: extras.height,
    teamId: extras.teamId,
  };
}
