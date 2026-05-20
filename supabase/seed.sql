-- OkHabit seed data
-- Runs automatically after migrations during `supabase db reset`.
--
-- Local dev test accounts (email / password):
--   test@test.com   / password   username: testuser    display: Test User
--   friend@test.com / password   username: frienduser  display: Friend User
--
-- Sign in as one account in the app, then add the other via Friends using their username.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  r RECORD;
  v_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('test@test.com',   'password', 'testuser',   'Test User'),
      ('friend@test.com', 'password', 'frienduser', 'Friend User')
    ) AS t(email, plain_password, username, display_name)
  LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE email = r.email;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      v_encrypted_pw := crypt(r.plain_password, gen_salt('bf'));

      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change_token_current,
        reauthentication_token,
        email_change,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        r.email,
        v_encrypted_pw,
        NOW(),
        '',
        '',
        '',
        '',
        '',
        '',
        '{"provider":"email","providers":["email"]}',
        '{}'::jsonb,
        NOW(),
        NOW()
      );

      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id,
        v_user_id,
        format('{"sub": "%s", "email": "%s"}', v_user_id, r.email)::jsonb,
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
      );
    END IF;

    INSERT INTO user_profiles (user_id, username, display_name, updated_at)
    VALUES (v_user_id, r.username, r.display_name, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
END $$;
