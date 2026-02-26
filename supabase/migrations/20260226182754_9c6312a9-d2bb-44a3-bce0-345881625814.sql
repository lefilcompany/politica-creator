
-- Create storage bucket for profile documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-documents', 'profile-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload their own documents (folder = user_id)
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: users can view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add column for document paths
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS evidence_documents jsonb DEFAULT '[]'::jsonb;
