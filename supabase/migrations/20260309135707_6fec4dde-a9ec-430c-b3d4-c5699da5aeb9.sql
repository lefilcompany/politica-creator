
-- Create agenda_events table for scheduled calendar events
CREATE TABLE public.agenda_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  event_type TEXT NOT NULL DEFAULT 'custom',
  color TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own or team events"
  ON public.agenda_events FOR SELECT
  USING (can_access_resource(user_id, team_id));

CREATE POLICY "Users can create events"
  ON public.agenda_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own or team events"
  ON public.agenda_events FOR UPDATE
  USING (can_access_resource(user_id, team_id));

CREATE POLICY "Users can delete own or team events"
  ON public.agenda_events FOR DELETE
  USING (can_access_resource(user_id, team_id));

-- Index for date-based queries
CREATE INDEX idx_agenda_events_date ON public.agenda_events(event_date);
CREATE INDEX idx_agenda_events_user ON public.agenda_events(user_id);
CREATE INDEX idx_agenda_events_team ON public.agenda_events(team_id);
