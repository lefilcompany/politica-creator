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
    .select('political_role, political_party, political_experience, political_level, focus_areas, main_social_networks, target_audience_description')
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
  if (!profile) return '';

  const lines: string[] = [];

  if (profile.political_role) {
    lines.push(`- Cargo político: ${profile.political_role}`);
  }
  if (profile.political_party) {
    lines.push(`- Partido: ${profile.political_party}`);
  }
  if (profile.political_level) {
    lines.push(`- Nível de atuação: ${profile.political_level}`);
  }
  if (profile.political_experience) {
    lines.push(`- Experiência política: ${profile.political_experience}`);
  }
  if (profile.focus_areas && profile.focus_areas.length > 0) {
    lines.push(`- Áreas de foco: ${profile.focus_areas.join(', ')}`);
  }
  if (profile.main_social_networks && profile.main_social_networks.length > 0) {
    lines.push(`- Redes sociais principais: ${profile.main_social_networks.join(', ')}`);
  }
  if (profile.target_audience_description) {
    lines.push(`- Público-alvo: ${profile.target_audience_description}`);
  }

  if (lines.length === 0) return '';

  return `\n# PERFIL POLÍTICO DO AUTOR\n${lines.join('\n')}\n\nIMPORTANTE: Considere o perfil político acima para adaptar tom, linguagem e contexto do conteúdo gerado. O conteúdo deve ser adequado ao cargo, partido e áreas de atuação do político.\n`;
}
