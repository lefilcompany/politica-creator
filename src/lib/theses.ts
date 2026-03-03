export interface Thesis {
  id: string;
  number: number;
  group: string;
  groupLabel: string;
  title: string;
  shortDescription: string;
}

export interface ThesisGroup {
  id: string;
  label: string;
  theses: Thesis[];
}

const GROUP_A: Thesis[] = [
  { id: "t1", number: 1, group: "A", groupLabel: "Poder, Governança e Instituições", title: "Poder distribuído em rede", shortDescription: "O poder não está mais concentrado em poucos — ele flui pelas redes e precisa ser exercido de forma colaborativa." },
  { id: "t2", number: 2, group: "A", groupLabel: "Poder, Governança e Instituições", title: "Governança líquida", shortDescription: "Governar não é mais estático — é um processo contínuo de adaptação às demandas da sociedade em tempo real." },
  { id: "t3", number: 3, group: "A", groupLabel: "Poder, Governança e Instituições", title: "Transparência estrutural", shortDescription: "A transparência não é uma escolha — é uma exigência permanente da cidadania conectada." },
  { id: "t4", number: 4, group: "A", groupLabel: "Poder, Governança e Instituições", title: "Instituições como plataformas", shortDescription: "As instituições precisam funcionar como plataformas abertas que permitem participação e inovação." },
  { id: "t5", number: 5, group: "A", groupLabel: "Poder, Governança e Instituições", title: "Soberania digital", shortDescription: "A soberania de um país ou cidade também se exerce no mundo digital, nos dados e nas plataformas." },
  { id: "t6", number: 6, group: "A", groupLabel: "Poder, Governança e Instituições", title: "Estado como habilitador", shortDescription: "O Estado deve habilitar a ação da sociedade, não controlar — ser plataforma, não gargalo." },
];

const GROUP_B: Thesis[] = [
  { id: "t7", number: 7, group: "B", groupLabel: "Dinâmica Política", title: "Política como fluxo contínuo", shortDescription: "Política não acontece só em eleições — é um processo diário de escuta, diálogo e ação." },
  { id: "t8", number: 8, group: "B", groupLabel: "Dinâmica Política", title: "Desacordo produtivo", shortDescription: "Democracia saudável não elimina conflitos — transforma divergências em soluções melhores para todos." },
  { id: "t9", number: 9, group: "B", groupLabel: "Dinâmica Política", title: "Micropolítica do cotidiano", shortDescription: "As grandes mudanças começam nas pequenas decisões do dia a dia, no bairro, na escola, no trabalho." },
  { id: "t10", number: 10, group: "B", groupLabel: "Dinâmica Política", title: "Polarização como sintoma", shortDescription: "A polarização é sintoma de um sistema que não oferece canais de diálogo — não é a doença em si." },
  { id: "t11", number: 11, group: "B", groupLabel: "Dinâmica Política", title: "Legitimidade pela escuta", shortDescription: "A legitimidade política se conquista ouvindo de verdade, não apenas falando para as câmeras." },
  { id: "t12", number: 12, group: "B", groupLabel: "Dinâmica Política", title: "Campanha permanente de valor", shortDescription: "Comunicar não é só pedir voto — é entregar valor, informação e presença constante para o cidadão." },
];

const GROUP_C: Thesis[] = [
  { id: "t13", number: 13, group: "C", groupLabel: "Narrativa, Afeto e Autenticidade", title: "Narrativa como infraestrutura", shortDescription: "Quem controla a narrativa, molda a realidade — contar histórias é tão importante quanto fazer obras." },
  { id: "t14", number: 14, group: "C", groupLabel: "Narrativa, Afeto e Autenticidade", title: "Empatia radical", shortDescription: "Se colocar no lugar do outro não é fraqueza — é a competência política mais poderosa do mundo figital." },
  { id: "t15", number: 15, group: "C", groupLabel: "Narrativa, Afeto e Autenticidade", title: "Autenticidade como moeda", shortDescription: "No mundo das redes, ser autêntico vale mais que ser perfeito — as pessoas conectam com verdade." },
  { id: "t16", number: 16, group: "C", groupLabel: "Narrativa, Afeto e Autenticidade", title: "Afeto como estratégia", shortDescription: "A política que emociona é a que mobiliza — sentimentos são o motor da ação cidadã." },
  { id: "t17", number: 17, group: "C", groupLabel: "Narrativa, Afeto e Autenticidade", title: "Comunicação figital", shortDescription: "A comunicação eficaz combina presença física e digital — o mundo figital exige os dois." },
  { id: "t18", number: 18, group: "C", groupLabel: "Narrativa, Afeto e Autenticidade", title: "Verdade como diferencial", shortDescription: "Em tempos de desinformação, quem fala a verdade com coragem se destaca naturalmente." },
  { id: "t19", number: 19, group: "C", groupLabel: "Narrativa, Afeto e Autenticidade", title: "Memória coletiva digital", shortDescription: "Tudo fica registrado no digital — construir uma memória coletiva positiva é responsabilidade política." },
];

const GROUP_D: Thesis[] = [
  { id: "t20", number: 20, group: "D", groupLabel: "Cidadania Expandida", title: "Cidadania expandida", shortDescription: "Ser cidadão vai além de votar — é participar, fiscalizar, propor e co-criar políticas públicas." },
  { id: "t21", number: 21, group: "D", groupLabel: "Cidadania Expandida", title: "Inclusão digital como direito", shortDescription: "Acesso à internet e à tecnologia é um direito fundamental, não um privilégio de poucos." },
  { id: "t22", number: 22, group: "D", groupLabel: "Cidadania Expandida", title: "Educação para o mundo figital", shortDescription: "Preparar as pessoas para o mundo figital é a maior política pública que um governo pode fazer." },
  { id: "t23", number: 23, group: "D", groupLabel: "Cidadania Expandida", title: "Participação como cultura", shortDescription: "Participação cidadã não pode ser eventual — precisa ser cultura, hábito, parte do dia a dia." },
  { id: "t24", number: 24, group: "D", groupLabel: "Cidadania Expandida", title: "Juventude como protagonista", shortDescription: "Os jovens não são o futuro da política — são o presente, e precisam ter voz e espaço agora." },
  { id: "t25", number: 25, group: "D", groupLabel: "Cidadania Expandida", title: "Imaginação cívica", shortDescription: "Uma sociedade que não imagina futuros melhores não consegue construí-los — a imaginação é ferramenta política." },
];

const GROUP_E: Thesis[] = [
  { id: "t26", number: 26, group: "E", groupLabel: "Complexidade, Resiliência e Ética", title: "Pensamento complexo na gestão", shortDescription: "Problemas complexos exigem soluções complexas — simplificar demais é enganar o cidadão." },
  { id: "t27", number: 27, group: "E", groupLabel: "Complexidade, Resiliência e Ética", title: "Antifragilidade institucional", shortDescription: "Instituições precisam não apenas resistir a crises, mas se fortalecer com elas." },
  { id: "t28", number: 28, group: "E", groupLabel: "Complexidade, Resiliência e Ética", title: "Ética algorítmica", shortDescription: "Algoritmos tomam decisões que afetam vidas — garantir que sejam éticos é dever do Estado." },
  { id: "t29", number: 29, group: "E", groupLabel: "Complexidade, Resiliência e Ética", title: "Sustentabilidade como premissa", shortDescription: "Sustentabilidade não é pauta opcional — é premissa de toda decisão política no século XXI." },
  { id: "t30", number: 30, group: "E", groupLabel: "Complexidade, Resiliência e Ética", title: "Dados como bem público", shortDescription: "Dados sobre a cidade e os cidadãos são bens públicos que devem servir a todos, não a poucos." },
  { id: "t31", number: 31, group: "E", groupLabel: "Complexidade, Resiliência e Ética", title: "Cooperação radical", shortDescription: "Os problemas do século XXI são grandes demais para um partido ou governo — exigem cooperação radical." },
  { id: "t32", number: 32, group: "E", groupLabel: "Complexidade, Resiliência e Ética", title: "Futuro como responsabilidade", shortDescription: "Governar é cuidar do futuro — cada decisão de hoje define o mundo que deixamos para as próximas gerações." },
];

export const ALL_THESES: Thesis[] = [
  ...GROUP_A, ...GROUP_B, ...GROUP_C, ...GROUP_D, ...GROUP_E,
];

export const THESIS_GROUPS: ThesisGroup[] = [
  { id: "A", label: "Poder, Governança e Instituições", theses: GROUP_A },
  { id: "B", label: "Dinâmica Política", theses: GROUP_B },
  { id: "C", label: "Narrativa, Afeto e Autenticidade", theses: GROUP_C },
  { id: "D", label: "Cidadania Expandida", theses: GROUP_D },
  { id: "E", label: "Complexidade, Resiliência e Ética", theses: GROUP_E },
];

export const getThesisById = (id: string): Thesis | undefined => {
  return ALL_THESES.find((t) => t.id === id);
};
