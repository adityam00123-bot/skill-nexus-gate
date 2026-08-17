-- Add closing_sticker_msg_id to telegram_ingestion_state
ALTER TABLE public.telegram_ingestion_state 
ADD COLUMN IF NOT EXISTS closing_sticker_msg_id integer;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_ingestion_state TO service_role;
GRANT SELECT ON public.telegram_ingestion_state TO authenticated;
GRANT SELECT ON public.telegram_ingestion_state TO anon;
