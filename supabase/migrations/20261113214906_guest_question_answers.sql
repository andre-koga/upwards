-- Guests answer the daily question without an account.
--
--   guest_question_answers  one answer per random guest id and day. The id is
--                           made on the device and kept there; nothing links it
--                           to an account, an email, an IP or a device id used
--                           elsewhere. RLS is on with no policy and no grant, so
--                           the table is unreachable except through the function
--                           below.
--
-- guest_question_results() records the answer and returns the crowd view in one
-- call, so a guest who answers offline and opens the question later still
-- counts. It is idempotent: the same id and day always overwrite the same row.
--
-- question_crowd() is the one place the counts are made. question_results()
-- (accounts) and guest_question_results() (guests) both call it, so guests and
-- accounts are counted together, one answer per person, and both share the same
-- floor of 5 people and the same output: counts per choice and nothing else.
--
-- Known and accepted: a guest id costs nothing to make, so a determined person
-- can add answers. The crowd view is for fun, not for decisions. A guest who
-- later makes an account is counted once as a guest and once as an account for
-- the question they answered while signed out.

CREATE TABLE guest_question_answers (
  guest_id UUID NOT NULL,
  answered_on DATE NOT NULL,
  question_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_id, answered_on),
  CONSTRAINT guest_question_answers_question_id_shape
    CHECK (question_id ~ '^[a-z0-9_]{1,32}$'),
  CONSTRAINT guest_question_answers_choice_id_shape
    CHECK (choice_id ~ '^[a-z0-9_]{1,16}$')
);

CREATE INDEX idx_guest_question_answers_crowd
  ON guest_question_answers(question_id, guest_id, answered_on DESC);

ALTER TABLE guest_question_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON guest_question_answers FROM PUBLIC, anon, authenticated;

-- The shared counting. Not callable from outside.
CREATE FUNCTION question_crowd(p_question_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_people CONSTANT INT := 5;
  total INT;
  counts JSONB;
BEGIN
  WITH accounts AS (
    SELECT DISTINCT ON (a.user_id) a.choice_id, a.in_crowd
    FROM question_answers a
    WHERE a.question_id = p_question_id
      AND a.deleted_at IS NULL
    ORDER BY a.user_id, a.answered_on DESC
  ),
  guests AS (
    SELECT DISTINCT ON (g.guest_id) g.choice_id, true AS in_crowd
    FROM guest_question_answers g
    WHERE g.question_id = p_question_id
    ORDER BY g.guest_id, g.answered_on DESC
  ),
  everyone AS (
    SELECT choice_id, in_crowd FROM accounts
    UNION ALL
    SELECT choice_id, in_crowd FROM guests
  ),
  counted AS (
    SELECT choice_id, count(*)::int AS n
    FROM everyone
    WHERE in_crowd
    GROUP BY choice_id
  )
  SELECT COALESCE(sum(n), 0)::int,
         COALESCE(jsonb_object_agg(choice_id, n), '{}'::jsonb)
  INTO total, counts
  FROM counted;

  IF total < min_people THEN
    RETURN jsonb_build_object('ready', false);
  END IF;

  RETURN jsonb_build_object('ready', true, 'total', total, 'counts', counts);
END;
$$;

REVOKE ALL ON FUNCTION question_crowd(TEXT) FROM PUBLIC, anon, authenticated;

-- Accounts: same rules as before, now counting guests too.
CREATE OR REPLACE FUNCTION question_results(p_question_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_question_id IS NULL OR p_question_id !~ '^[a-z0-9_]{1,32}$' THEN
    RAISE EXCEPTION 'invalid question';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM question_answers a
    WHERE a.user_id = uid
      AND a.question_id = p_question_id
      AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'answer the question first'
      USING ERRCODE = '42501';
  END IF;

  RETURN question_crowd(p_question_id);
END;
$$;

-- Guests: record the answer, then return the same view.
--
-- It writes, so it is VOLATILE. The day must be today or a day either side of
-- the server's date, which covers every time zone and stops a guest from
-- backdating or pre-answering.
CREATE FUNCTION guest_question_results(
  p_guest_id UUID,
  p_question_id TEXT,
  p_choice_id TEXT,
  p_answered_on DATE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_guest_id IS NULL
     OR p_question_id IS NULL OR p_question_id !~ '^[a-z0-9_]{1,32}$'
     OR p_choice_id IS NULL OR p_choice_id !~ '^[a-z0-9_]{1,16}$'
     OR p_answered_on IS NULL
     OR abs(p_answered_on - (now() AT TIME ZONE 'utc')::date) > 1 THEN
    RAISE EXCEPTION 'invalid answer';
  END IF;

  INSERT INTO guest_question_answers(
    guest_id, answered_on, question_id, choice_id)
  VALUES (p_guest_id, p_answered_on, p_question_id, p_choice_id)
  ON CONFLICT (guest_id, answered_on) DO UPDATE SET
    question_id = EXCLUDED.question_id,
    choice_id = EXCLUDED.choice_id,
    updated_at = now();

  RETURN question_crowd(p_question_id);
END;
$$;

REVOKE ALL ON FUNCTION guest_question_results(UUID, TEXT, TEXT, DATE)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION guest_question_results(UUID, TEXT, TEXT, DATE)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
