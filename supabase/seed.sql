-- OkHabit seed data
-- Runs automatically after migrations during `supabase db reset`.
--
-- Local dev test account (email / password):
--   test@test.com / password

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
  v_email TEXT := 'test@test.com';
  v_password TEXT := 'password';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

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
      v_email,
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
      format('{"sub": "%s", "email": "%s"}', v_user_id, v_email)::jsonb,
      'email',
      v_user_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  INSERT INTO user_profiles (user_id, updated_at, locale)
  VALUES (v_user_id, NOW(), 'en')
  ON CONFLICT (user_id) DO UPDATE SET
    updated_at = EXCLUDED.updated_at,
    locale = COALESCE(user_profiles.locale, EXCLUDED.locale);
END $$;
