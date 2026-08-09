-- Add reply_to_id to support_messages
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.support_messages(id) ON DELETE SET NULL;
