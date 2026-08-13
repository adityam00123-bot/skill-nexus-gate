CREATE TABLE IF NOT EXISTS public.course_video_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id text NOT NULL,
    telegram_message_id text NOT NULL,
    duration_seconds integer NOT NULL,
    posted_at timestamptz DEFAULT now(),
    UNIQUE(channel_id, telegram_message_id)
);

ALTER TABLE public.course_video_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read all logs" ON public.course_video_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin insert logs" ON public.course_video_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update logs" ON public.course_video_log FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete logs" ON public.course_video_log FOR DELETE USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_video_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_video_log TO service_role;
