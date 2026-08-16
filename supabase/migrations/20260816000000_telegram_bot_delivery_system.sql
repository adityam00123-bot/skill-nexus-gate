-- ============================================================================
-- Migration: Telegram Dual-Bot Delivery System & Storage Channel Ingestion
-- Description:
--   1. telegram_delivery_tokens (Single-use 10-min tokens for content delivery)
--   2. telegram_delivered_messages (Audit log of delivered copies for auto-delete)
--   3. telegram_unmatched_uploads (Audit log for unmatched storage channel posts)
--   4. telegram_ingestion_state (Singleton upload context state for storage channel)
--   5. telegram_link_tokens (Single-use 30-min tokens for linking web account to Telegram)
--   6. profiles.telegram_id (Direct Telegram ID column on profiles)
--   7. course_video_log.course_id (Direct course_id relationship on video log)
-- ============================================================================

-- 1. Table: telegram_delivery_tokens
CREATE TABLE IF NOT EXISTS public.telegram_delivery_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    telegram_id bigint NOT NULL,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'issued' CHECK (
        status IN ('issued', 'delivered', 'rejected_mismatch', 'rejected_no_purchase', 'expired', 'already_used')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    consumed_at timestamptz
);

ALTER TABLE public.telegram_delivery_tokens ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tg_delivery_tokens_user_id ON public.telegram_delivery_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_delivery_tokens_telegram_id ON public.telegram_delivery_tokens(telegram_id);
CREATE INDEX IF NOT EXISTS idx_tg_delivery_tokens_course_id ON public.telegram_delivery_tokens(course_id);
CREATE INDEX IF NOT EXISTS idx_tg_delivery_tokens_status ON public.telegram_delivery_tokens(status);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_delivery_tokens TO service_role;
GRANT SELECT ON public.telegram_delivery_tokens TO authenticated;


-- 2. Table: telegram_delivered_messages
CREATE TABLE IF NOT EXISTS public.telegram_delivered_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_chat_id bigint NOT NULL,
    telegram_message_id bigint NOT NULL,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    sent_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

ALTER TABLE public.telegram_delivered_messages ENABLE ROW LEVEL SECURITY;

-- Indexes for cron cleanup queries
CREATE INDEX IF NOT EXISTS idx_tg_delivered_messages_cleanup ON public.telegram_delivered_messages(deleted_at, sent_at);
CREATE INDEX IF NOT EXISTS idx_tg_delivered_messages_chat_id ON public.telegram_delivered_messages(telegram_chat_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_delivered_messages TO service_role;
GRANT SELECT ON public.telegram_delivered_messages TO authenticated;


-- 3. Table: telegram_unmatched_uploads
CREATE TABLE IF NOT EXISTS public.telegram_unmatched_uploads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_caption text,
    telegram_message_id bigint NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved boolean NOT NULL DEFAULT false
);

ALTER TABLE public.telegram_unmatched_uploads ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tg_unmatched_uploads_created_at ON public.telegram_unmatched_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tg_unmatched_uploads_resolved ON public.telegram_unmatched_uploads(resolved);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_unmatched_uploads TO service_role;
GRANT SELECT ON public.telegram_unmatched_uploads TO authenticated;


-- 4. Table: telegram_ingestion_state
CREATE TABLE IF NOT EXISTS public.telegram_ingestion_state (
    id integer PRIMARY KEY CHECK (id = 1),
    current_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    current_course_number integer,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_ingestion_state ENABLE ROW LEVEL SECURITY;

-- Seed singleton row
INSERT INTO public.telegram_ingestion_state (id, current_course_id, current_course_number, updated_at)
VALUES (1, NULL, NULL, now())
ON CONFLICT (id) DO NOTHING;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_ingestion_state TO service_role;
GRANT SELECT ON public.telegram_ingestion_state TO authenticated;


-- 5. Table: telegram_link_tokens
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'issued' CHECK (
        status IN ('issued', 'consumed', 'expired')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
    consumed_at timestamptz
);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own link tokens
CREATE POLICY "Users can insert own link tokens"
    ON public.telegram_link_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own link tokens"
    ON public.telegram_link_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tg_link_tokens_user_id ON public.telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_link_tokens_status ON public.telegram_link_tokens(status);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_link_tokens TO service_role;
GRANT SELECT, INSERT ON public.telegram_link_tokens TO authenticated;


-- 6. Add telegram_id to profiles table (if not already present)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS telegram_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_telegram_id_unique
ON public.profiles(telegram_id)
WHERE telegram_id IS NOT NULL;


-- 7. Add course_id to course_video_log table (if not already present)
ALTER TABLE public.course_video_log
ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_course_video_log_course_id
ON public.course_video_log(course_id);

-- Explicit Grants on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_video_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_video_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;
