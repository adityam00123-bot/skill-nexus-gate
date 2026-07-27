-- Telegram Bot Channels Table

CREATE TABLE IF NOT EXISTS public.telegram_bot_channels (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id text NOT NULL UNIQUE,
    channel_title text NOT NULL,
    detected_at timestamptz DEFAULT now(),
    assigned_to_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL
);

-- RLS Policies
ALTER TABLE public.telegram_bot_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read all channels"
    ON public.telegram_bot_channels
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admin update all channels"
    ON public.telegram_bot_channels
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert channels"
    ON public.telegram_bot_channels
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin delete channels"
    ON public.telegram_bot_channels
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- Explicit Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_bot_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_bot_channels TO service_role;
