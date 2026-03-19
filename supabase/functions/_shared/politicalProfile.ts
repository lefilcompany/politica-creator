/**
 * Shared helper to fetch the user's political profile and build
 * a context string that can be injected into any AI prompt.
 */
export interface PoliticalProfile {
  political_role: string | null;
  political_party: string | null;
  political_experience: string | null;
  political_level: string | null;
  focus_areas: string[] | null;
  main_social_networks: string[] | null;
  target_audience_description: string | null;
  mandate_stage: string | null;
  biography: string | null;
  tone_of_voice: string | null;
  red_lines: string | null;
  evidence_history: string | null;
  instagram_handle: string | null;
  name: string | null;
  state: string | null;
  city: string | null;
}

/**
 * Fetches the political profile fields for a given user.
 */
export async function fetchPoliticalProfile(
  supabase: any,
  userId: string
): Promise<PoliticalProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('political_role, political_party, political_experience, political_level, focus_areas, main_social_networks, target_audience_description, mandate_stage, biography, tone_of_voice, red_lines, evidence_history, instagram_handle, name, state, city')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as PoliticalProfile;
}

/**
 * Builds a context string from the political profile to inject into AI prompts.
 * Returns empty string if no political data is available.
 */
export function buildPoliticalContext(profile: PoliticalProfile | null): string {
  const parts: string[] = [];

  // Inject political profile context
  if (profile) {
    const lines: string[] = [];

    // Instagram handle — central reference for tone of voice
    if (profile.instagram_handle) {
      lines.push(`- Instagram: @${profile.instagram_handle}`);
      parts.push(`\n# REFERÊNCIA DE TOM DE VOZ — INSTAGRAM\nO perfil @${profile.instagram_handle} é a PRINCIPAL referência de estilo. Todo conteúdo gerado DEVE imitar o tom de voz, estilo de escrita, linguagem e forma de se comunicar deste perfil no Instagram. Analise mentalmente como @${profile.instagram_handle} se comunica e replique esse padrão.\n`);
    }

    if (profile.name) lines.push(`- Nome: ${profile.name}`);
    if (profile.state) lines.push(`- Estado: ${profile.state}`);
    if (profile.city) lines.push(`- Cidade: ${profile.city}`);
    if (profile.political_role) lines.push(`- Cargo político: ${profile.political_role}`);
    if (profile.political_party) lines.push(`- Partido: ${profile.political_party}`);
    if (profile.political_level) lines.push(`- Nível de atuação: ${profile.political_level}`);
    if (profile.political_experience) lines.push(`- Experiência política: ${profile.political_experience}`);
    if (profile.mandate_stage) lines.push(`- Fase atual: ${profile.mandate_stage}`);
    if (profile.focus_areas && profile.focus_areas.length > 0) lines.push(`- Áreas de foco: ${profile.focus_areas.join(', ')}`);
    if (profile.main_social_networks && profile.main_social_networks.length > 0) lines.push(`- Redes sociais principais: ${profile.main_social_networks.join(', ')}`);
    if (profile.target_audience_description) lines.push(`- Público-alvo: ${profile.target_audience_description}`);
    if (profile.biography) lines.push(`- Biografia e trajetória: ${profile.biography}`);
    if (profile.tone_of_voice) lines.push(`- Tom de voz preferido: ${profile.tone_of_voice}`);
    if (profile.evidence_history) lines.push(`- Evidências e histórico: ${profile.evidence_history}`);

    if (lines.length > 0) {
      parts.push(`\n# PERFIL DO AUTOR\n${lines.join('\n')}\n`);
    }

    if (profile.red_lines) {
      parts.push(`\n# TEMAS SENSÍVEIS (RESTRIÇÕES ABSOLUTAS)\n${profile.red_lines}\n\nATENÇÃO: Os temas sensíveis acima são PROIBIÇÕES. O conteúdo NUNCA deve violar essas restrições.\n`);
    }

    if (lines.length > 0) {
      parts.push(`\nIMPORTANTE: Considere o perfil acima para adaptar tom, linguagem e contexto do conteúdo gerado.\n`);
    }
  }

  return parts.join('\n');
}
