-- ==============================================================================
-- Migration: Per-Course Telegram Access, Link Tokens & Course Materials Tracking
-- ==============================================================================

-- 1. Add course_id to telegram_link_tokens so tokens are locked to a specific course
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'telegram_link_tokens' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE public.telegram_link_tokens 
    ADD COLUMN course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add total_materials to courses table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' AND column_name = 'total_materials'
  ) THEN
    ALTER TABLE public.courses 
    ADD COLUMN total_materials INTEGER DEFAULT 0;
  END IF;
END $$;

-- 3. Add file_type to course_video_log table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'course_video_log' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE public.course_video_log 
    ADD COLUMN file_type TEXT DEFAULT 'video';
  END IF;
END $$;

-- 4. Ensure telegram_access table exists and has unique constraint on (user_id, course_id)
CREATE TABLE IF NOT EXISTS public.telegram_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  joined_telegram_user_id BIGINT,
  joined_telegram_username TEXT,
  invite_link TEXT,
  link_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telegram_access_user_course_unique UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_access_user_id ON public.telegram_access(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_access_course_id ON public.telegram_access(course_id);
CREATE INDEX IF NOT EXISTS idx_telegram_access_tg_user_id ON public.telegram_access(joined_telegram_user_id);

-- 5. Enable RLS and Explicit Grants
ALTER TABLE public.telegram_access ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'telegram_access' AND policyname = 'Users can view their own telegram access'
  ) THEN
    CREATE POLICY "Users can view their own telegram access"
      ON public.telegram_access FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT ALL ON public.telegram_access TO service_role;
GRANT SELECT ON public.telegram_access TO authenticated;
GRANT ALL ON public.telegram_link_tokens TO service_role;
GRANT ALL ON public.course_video_log TO service_role;
GRANT ALL ON public.courses TO service_role;
