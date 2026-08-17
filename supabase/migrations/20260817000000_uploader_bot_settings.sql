-- Migration: 20260817000000_uploader_bot_settings.sql
-- Description: Dynamic settings for CourseVerse Auto-Uploader & Formatter Bot (@CourseVerseUploaderbot)

CREATE TABLE IF NOT EXISTS public.uploader_bot_settings (
    id integer PRIMARY KEY CHECK (id = 1),
    incoming_channel_id text NOT NULL DEFAULT '-1002811299812',
    outgoing_channel_id text NOT NULL DEFAULT '-1004345664449',
    header_template text,
    video_template text,
    material_template text,
    custom_emoji_star text,
    custom_emoji_verified text,
    custom_emoji_vault text,
    dm_link text NOT NULL DEFAULT 'https://t.me/CourseVerseHere',
    vault_link text NOT NULL DEFAULT 'https://t.me/+FZIshSGq54FkYzg1',
    awaiting_input text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uploader_bot_settings ENABLE ROW LEVEL SECURITY;

-- Seed singleton settings row
INSERT INTO public.uploader_bot_settings (
    id,
    incoming_channel_id,
    outgoing_channel_id,
    dm_link,
    vault_link,
    updated_at
) VALUES (
    1,
    '-1002811299812',
    '-1004345664449',
    'https://t.me/CourseVerseHere',
    'https://t.me/+FZIshSGq54FkYzg1',
    now()
)
ON CONFLICT (id) DO NOTHING;

-- Explicit Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploader_bot_settings TO service_role;
GRANT SELECT ON public.uploader_bot_settings TO authenticated;
