export const CREDIT_COSTS = {
  QUICK_IMAGE: 5,           // Imagem rápida (QuickContent)
  COMPLETE_IMAGE: 6,        // Imagem completa (CreateContent)
  IMAGE_GENERATION: 5,      // Geração de imagem standalone
  IMAGE_EDIT: 1,            // Correção/ajuste de imagem
  IMAGE_REVIEW: 2,          // Revisão de imagem
  CAPTION_REVIEW: 2,        // Revisão de legenda
  TEXT_REVIEW: 2,           // Revisão de copy/texto
  CONTENT_PLAN: 3,          // Planejamento de conteúdo
  VIDEO_GENERATION: 20,     // Geração de vídeo
  FAKE_NEWS_MONITOR: 2,     // Monitor de fake news
  FAKE_NEWS_RESPOND: 3,     // Resposta a fake news
  FACT_CHECK: 1,            // Verificação de conteúdo
  CAMPAIGN_PACKAGE: 50,     // Pacote de campanha completo
  ANALYZE_REPERCUSSION: 2,  // Análise de repercussão
  CRISIS_ANALYSIS: 3,       // Análise de crise (sala de situação)
  GENERATE_TEXT: 3,          // Geração de texto político (10 variações)
} as const;

export const FREE_RESOURCE_LIMITS = {
  BRANDS: 3,
  PERSONAS: 3,
  THEMES: 3,
} as const;

/**
 * Valida se um time tem créditos suficientes para uma ação
 * @param currentCredits - Saldo atual de créditos
 * @param actionType - Tipo da ação (chave de CREDIT_COSTS)
 * @returns true se tem créditos suficientes, false caso contrário
 */
export function hasEnoughCredits(
  currentCredits: number, 
  actionType: keyof typeof CREDIT_COSTS
): boolean {
  return currentCredits >= CREDIT_COSTS[actionType];
}

/**
 * Retorna mensagem de erro formatada para créditos insuficientes
 * @param currentCredits - Saldo atual de créditos
 * @param actionType - Tipo da ação (chave de CREDIT_COSTS)
 * @returns Objeto de erro formatado
 */
export function getInsufficientCreditsError(
  currentCredits: number,
  actionType: keyof typeof CREDIT_COSTS
) {
  const required = CREDIT_COSTS[actionType];
  return {
    error: 'Créditos insuficientes',
    required,
    available: currentCredits,
    message: `São necessários ${required} créditos. Você tem ${currentCredits}.`
  };
}
