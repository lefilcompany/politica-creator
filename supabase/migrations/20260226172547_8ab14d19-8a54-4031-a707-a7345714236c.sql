
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mandate_stage text,
  ADD COLUMN IF NOT EXISTS biography text,
  ADD COLUMN IF NOT EXISTS tone_of_voice text,
  ADD COLUMN IF NOT EXISTS red_lines text,
  ADD COLUMN IF NOT EXISTS evidence_history text,
  ADD COLUMN IF NOT EXISTS profile_detail_completed boolean DEFAULT false;
