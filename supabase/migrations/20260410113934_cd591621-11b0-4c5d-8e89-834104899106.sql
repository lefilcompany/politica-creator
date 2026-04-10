
-- Create conversations table
CREATE TABLE public.book_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.book_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.book_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.book_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can view own conversations"
  ON public.book_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations"
  ON public.book_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.book_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.book_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for messages
CREATE POLICY "Users can view messages in own conversations"
  ON public.book_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.book_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON public.book_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.book_conversations WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_book_conversations_user_id ON public.book_conversations(user_id);
CREATE INDEX idx_book_messages_conversation_id ON public.book_messages(conversation_id);
CREATE INDEX idx_book_messages_created_at ON public.book_messages(created_at);

-- Updated at trigger
CREATE TRIGGER update_book_conversations_updated_at
  BEFORE UPDATE ON public.book_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
