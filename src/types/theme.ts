import type { Plan } from "./plan";

export type SignalItem = {
  title: string;
  description: string;
  category: 'fato_confirmado' | 'noticia_local' | 'dado_publico' | 'release_institucional' | 'rumor' | 'tendencia';
  status: 'verificado' | 'nao_verificado' | 'parcialmente_verificado';
  relevance: 'alta' | 'media' | 'baixa';
  source_hint: string;
  date_hint: string;
};

export type StrategicTheme = {
  id: string;
  teamId: string;
  userId: string;
  brandId: string;
  title: string;
  description: string;
  colorPalette: string;
  toneOfVoice: string;
  targetAudience: string;
  hashtags: string;
  objectives: string;
  contentFormat: string;
  macroThemes: string;
  bestFormats: string;
  platforms: string;
  expectedAction: string;
  additionalInfo: string;
  tags: string[];
  subtags: Record<string, string[]>;
  objectiveType: string;
  signals: SignalItem[];
  createdAt: string;
  updatedAt: string;
};

// Dados mínimos utilizados nas listagens de temas
export type StrategicThemeSummary = Pick<StrategicTheme, 'id' | 'brandId' | 'title' | 'createdAt'>;

export interface Team {
  id: string;
  name: string;
  code?: string;
  displayCode?: string;
  admin: string; // admin email
  admin_id?: string; // admin user id
  members: string[];
  pending: string[];
  plan: Plan | null;
  credits: number; // Créditos unificados
  free_brands_used: number; // Contador de marcas gratuitas usadas
  free_personas_used: number; // Contador de personas gratuitas usadas
  free_themes_used: number; // Contador de temas gratuitos usados
}


export interface TeamSummary {
  id: string;
  name: string;
  code: string;
  plan: Team['plan'];
  credits?: Team['credits'];
  totalBrands: number;
  totalContents: number;
}