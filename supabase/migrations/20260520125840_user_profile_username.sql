-- Add username to user_profiles.
-- Format: 3-20 lowercase alphanumeric + underscore.
-- Case-insensitive uniqueness enforced via a unique index on lower(username).

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS username TEXT
        CHECK (username ~ '^[a-z0-9_]{3,20}$');

-- Case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_username_lower
    ON user_profiles (lower(username))
    WHERE username IS NOT NULL;

-- Controlled exact-match lookup function (no enumeration / prefix search)
CREATE OR REPLACE FUNCTION lookup_user_by_username(exact_username TEXT)
RETURNS TABLE(user_id UUID, username TEXT, display_name TEXT)
SECURITY DEFINER
LANGUAGE sql STABLE
AS $$
  SELECT user_id, username, display_name
  FROM user_profiles
  WHERE lower(username) = lower(exact_username)
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION lookup_user_by_username(TEXT) TO authenticated;
