
-- Add structured fields for Module B (Strategic Agenda)
ALTER TABLE public.strategic_themes 
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subtags jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objective_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS signals jsonb DEFAULT '[]';

-- Add index for tags search
CREATE INDEX IF NOT EXISTS idx_strategic_themes_tags ON public.strategic_themes USING GIN(tags);
