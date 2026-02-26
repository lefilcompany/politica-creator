
-- Add political profile columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS political_role text NULL,
ADD COLUMN IF NOT EXISTS political_party text NULL,
ADD COLUMN IF NOT EXISTS political_experience text NULL,
ADD COLUMN IF NOT EXISTS focus_areas text[] NULL,
ADD COLUMN IF NOT EXISTS main_social_networks text[] NULL,
ADD COLUMN IF NOT EXISTS target_audience_description text NULL,
ADD COLUMN IF NOT EXISTS political_level text NULL;

-- political_role: vereador, prefeito, deputado estadual, deputado federal, senador, governador, etc.
-- political_party: sigla do partido
-- political_experience: primeiro_mandato, reeleicao, pre_candidato, assessor
-- focus_areas: saúde, educação, segurança, etc.
-- main_social_networks: instagram, facebook, tiktok, twitter, youtube
-- target_audience_description: descrição livre do público-alvo
-- political_level: municipal, estadual, federal

COMMENT ON COLUMN public.profiles.political_role IS 'Cargo político do usuário';
COMMENT ON COLUMN public.profiles.political_party IS 'Partido político (sigla)';
COMMENT ON COLUMN public.profiles.political_experience IS 'Nível de experiência política';
COMMENT ON COLUMN public.profiles.focus_areas IS 'Áreas de atuação principal';
COMMENT ON COLUMN public.profiles.main_social_networks IS 'Redes sociais mais utilizadas';
COMMENT ON COLUMN public.profiles.target_audience_description IS 'Descrição do público-alvo';
COMMENT ON COLUMN public.profiles.political_level IS 'Nível de atuação: municipal, estadual, federal';
