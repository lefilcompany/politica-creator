export const CREDIT_COSTS = {
  QUICK_IMAGE: 5,
  COMPLETE_IMAGE: 6,
  IMAGE_GENERATION: 5,
  IMAGE_EDIT: 1,
  IMAGE_REVIEW: 2,
  CAPTION_REVIEW: 2,
  TEXT_REVIEW: 2,
  CONTENT_PLAN: 3,
  VIDEO_GENERATION: 20,
  FAKE_NEWS_MONITOR: 2,
  FAKE_NEWS_RESPOND: 3,
  FACT_CHECK: 1,
  COLLECT_SIGNALS: 1,
  CAMPAIGN_PACKAGE: 50,
  ANALYZE_REPERCUSSION: 2,
} as const;

export const getCreditCostLabel = (action: keyof typeof CREDIT_COSTS): string => {
  const labels: Record<keyof typeof CREDIT_COSTS, string> = {
    QUICK_IMAGE: "Imagem rápida",
    COMPLETE_IMAGE: "Imagem completa",
    IMAGE_GENERATION: "Geração de imagem",
    IMAGE_EDIT: "Correção de imagem",
    IMAGE_REVIEW: "Revisão de imagem",
    CAPTION_REVIEW: "Revisão de legenda",
    TEXT_REVIEW: "Revisão de texto",
    CONTENT_PLAN: "Planejamento de conteúdo",
    VIDEO_GENERATION: "Geração de vídeo",
    FAKE_NEWS_MONITOR: "Monitor de fake news",
    FAKE_NEWS_RESPOND: "Resposta a fake news",
    FACT_CHECK: "Verificação de conteúdo",
    COLLECT_SIGNALS: "Coleta de sinais",
    CAMPAIGN_PACKAGE: "Pacote de campanha",
    ANALYZE_REPERCUSSION: "Análise de repercussão",
  };
  return labels[action];
};

export const formatCredits = (credits: number): string => {
  return `${credits} ${credits === 1 ? 'crédito' : 'créditos'}`;
};
