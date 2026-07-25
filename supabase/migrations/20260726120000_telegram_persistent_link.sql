-- Add persistent_access_link to telegram_bot_channels
ALTER TABLE public.telegram_bot_channels 
ADD COLUMN IF NOT EXISTS persistent_access_link text;

-- Create telegram_join_requests table to log declined attempts
CREATE TABLE IF NOT EXISTS public.telegram_join_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id text NOT NULL,
    telegram_user_id bigint NOT NULL,
    telegram_username text,
    timestamp timestamptz DEFAULT now()
);

-- RLS Policies for telegram_join_requests
ALTER TABLE public.telegram_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read all join requests"
    ON public.telegram_join_requests
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert join requests"
    ON public.telegram_join_requests
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
