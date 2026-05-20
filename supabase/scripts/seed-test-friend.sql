-- Add the friend test user without wiping your local DB.
-- Run from project root:
--   psql "$(pnpm supabase status -o env | grep DATABASE_URL | cut -d= -f2-)" -f supabase/scripts/seed-test-friend.sql
-- Or paste into Supabase Studio → SQL Editor (local: http://localhost:65423).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_email TEXT := 'friend@test.com';
  v_password TEXT := 'password';
  v_username TEXT := 'frienduser';
  v_display_name TEXT := 'Friend User';
  v_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current,
      reauthentication_token, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email, v_encrypted_pw, NOW(),
      '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}',
      '{}'::jsonb, NOW(), NOW()
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      v_user_id, v_user_id,
      format('{"sub": "%s", "email": "%s"}', v_user_id, v_email)::jsonb,
      'email', v_user_id::text, NOW(), NOW(), NOW()
    );
  END IF;

  INSERT INTO user_profiles (user_id, username, display_name, updated_at)
  VALUES (v_user_id, v_username, v_display_name, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    updated_at = EXCLUDED.updated_at;
END $$;
