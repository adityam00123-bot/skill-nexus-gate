-- Add telegram_channel_id to courses
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS telegram_channel_id text;

-- Create telegram_access table
CREATE TABLE IF NOT EXISTS public.telegram_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    invite_link text NOT NULL,
    telegram_channel_id text NOT NULL,
    link_used boolean DEFAULT false,
    expires_at timestamptz NOT NULL,
    joined_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.telegram_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own telegram_access"
ON public.telegram_access
FOR SELECT
USING (auth.uid() = user_id);

-- Provide service role access for all operations (needed for backend APIs)
-- Since service role bypasses RLS by default, we technically don't need a specific policy,
-- but we might want one if accessing via anon/authenticated in some other ways.
-- However, we only do inserts/updates via the API using service role, so this is fine.
