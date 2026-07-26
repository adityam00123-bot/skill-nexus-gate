-- Migration to add tracking columns to telegram_access
ALTER TABLE telegram_access 
ADD COLUMN joined_telegram_user_id bigint,
ADD COLUMN joined_telegram_username text;
