-- Add attachment_url to support_messages
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS attachment_url text;

-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support_attachments', 'support_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for support_attachments
-- Allow public read access to support_attachments
CREATE POLICY "Public Read Access for support_attachments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'support_attachments');

-- Allow authenticated users to upload to support_attachments
CREATE POLICY "Authenticated users can upload to support_attachments" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'support_attachments');

-- Allow users to delete their own uploads or admins to delete any
CREATE POLICY "Users can manage own uploads to support_attachments" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'support_attachments' 
  AND (
    (auth.uid() = owner) 
    OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
);
