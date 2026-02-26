-- Add column to store recommended theses from onboarding
ALTER TABLE public.profiles
ADD COLUMN recommended_theses JSONB DEFAULT NULL;