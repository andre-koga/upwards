-- The crowd results for the daily question appear once 5 people are counted,
-- down from 10. Same function and same rules otherwise: counts per choice only,
-- nothing at all below the floor, and only to someone who has answered.
--
-- With a lower floor the known trade-off from question_answers is a little
-- sharper: someone who reads the results twice can see that a count moved,
-- which says that somebody answered, not who or when.

CREATE OR REPLACE FUNCTION question_results(p_question_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  min_people CONSTANT INT := 5;
  total INT;
  counts JSONB;
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

  WITH latest AS (
    SELECT DISTINCT ON (a.user_id) a.user_id, a.choice_id, a.in_crowd
    FROM question_answers a
    WHERE a.question_id = p_question_id
      AND a.deleted_at IS NULL
    ORDER BY a.user_id, a.answered_on DESC
  ),
  counted AS (
    SELECT choice_id, count(*)::int AS n
    FROM latest
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

NOTIFY pgrst, 'reload schema';
