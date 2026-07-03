-- Add locale to user_profiles so language preference syncs across devices.
-- Value is a supported app locale code (e.g. "en"); NULL means "not yet set".

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS locale TEXT;
