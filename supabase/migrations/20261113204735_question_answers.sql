-- The daily question on the You page.
--
--   question_answers  one answer per account and day. The id is derived from
--                     the account and the date, so the same day answered on two
--                     devices meets as a conflict to review instead of becoming
--                     two answers. `why` is a private note; it is never read by
--                     question_results. `in_crowd` says whether the answer is
--                     counted in the anonymous results.
--
-- Written through submit_sync_operations (SECURITY DEFINER) with the same
-- optimistic concurrency as the personality tables: a stale base_revision is a
-- conflict that is recorded, not applied, and stays reviewable in the app.
--
-- The crowd view, question_results(), is the only way anything about other
-- people's answers leaves the database. It returns counts per choice and
-- nothing else: no user ids, no "why" text, no dates. It refuses unless the
-- caller has a live answer to that question, and returns nothing at all while
-- fewer than 10 people are counted.
--
-- Known and accepted: someone who reads the results twice can compare the two
-- and see that the counts moved. With the 10-person floor and counts only, that
-- reveals that somebody answered, not who or when.

CREATE TABLE question_answers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  why TEXT,
  answered_on DATE NOT NULL,
  in_crowd BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT question_answers_question_id_shape
    CHECK (question_id ~ '^[a-z0-9_]{1,32}$'),
  CONSTRAINT question_answers_choice_id_shape
    CHECK (choice_id ~ '^[a-z0-9_]{1,16}$'),
  CONSTRAINT question_answers_why_length
    CHECK (why IS NULL OR char_length(why) <= 280)
);

-- One live answer per account and day.
CREATE UNIQUE INDEX uq_question_answers_user_day
  ON question_answers(user_id, answered_on)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_question_answers_user_question
  ON question_answers(user_id, question_id);

-- The crowd view only ever reads live, opted-in rows for one question.
CREATE INDEX idx_question_answers_crowd
  ON question_answers(question_id, user_id, answered_on DESC)
  WHERE deleted_at IS NULL;

-- Writes go through submit_sync_operations; the client only reads its own rows.
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own question answers"
  ON question_answers FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON question_answers TO authenticated;

-- submit_sync_operations_ungated ---------------------------------------------
-- Keep the existing body under a new name and put a branch for the new entity
-- type in front of it. Edit THIS function when changing its behavior; do not
-- recreate the one-argument signatures.
--
-- Same rules as the personality tables:
--   * a stale base_revision is a conflict: the server's row is strictly NEWER
--     than the base (compared as a timestamp);
--   * an op with no base that meets a row that already exists is a conflict, so
--     two devices that start from nothing are reviewed, not merged;
--   * a replay of an operation id is a duplicate and writes nothing.
-- A conflicting op is recorded but not applied. Each op runs in its own block so
-- one bad row cannot abort the batch.

ALTER FUNCTION submit_sync_operations_ungated(JSONB)
  RENAME TO submit_sync_operations_before_question_answers;
REVOKE ALL ON FUNCTION submit_sync_operations_before_question_answers(JSONB)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION submit_sync_operations_ungated(ops JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  op JSONB;
  row JSONB;
  results JSONB := '[]'::jsonb;
  answer_ops JSONB := '[]'::jsonb;
  other_ops JSONB := '[]'::jsonb;
  op_id UUID;
  entity_id UUID;
  base_ts TIMESTAMPTZ;
  remote_ts TIMESTAMPTZ;
  remote_owner UUID;
  op_status TEXT;
  seq BIGINT;
  existing_seq BIGINT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(COALESCE(ops, '[]'::jsonb)) LOOP
    IF op->>'entity_type' = 'question_answer' THEN
      answer_ops := answer_ops || jsonb_build_array(op);
    ELSE
      other_ops := other_ops || jsonb_build_array(op);
    END IF;
  END LOOP;

  IF jsonb_array_length(other_ops) > 0 THEN
    results := submit_sync_operations_before_question_answers(other_ops);
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(answer_ops) LOOP
    BEGIN
      op_id := NULLIF(op->>'operation_id', '')::uuid;
      entity_id := NULLIF(op->>'entity_id', '')::uuid;
      remote_ts := NULL;
      remote_owner := NULL;
      IF op_id IS NULL OR entity_id IS NULL
         OR op->>'operation_type' <> 'projection.upsert' THEN
        CONTINUE;
      END IF;

      SELECT server_sequence INTO existing_seq
      FROM sync_operations WHERE user_id = uid AND operation_id = op_id;
      IF existing_seq IS NOT NULL THEN
        results := results || jsonb_build_array(jsonb_build_object(
          'operation_id', op_id, 'status', 'duplicate',
          'server_sequence', existing_seq));
        CONTINUE;
      END IF;

      row := COALESCE(op->'payload'->'row', '{}'::jsonb);
      base_ts := NULLIF(op->>'base_revision', '')::timestamptz;

      -- Looked up by id alone, so a row that belongs to someone else is seen
      -- and refused below instead of being skipped and reported as saved.
      SELECT a.updated_at, a.user_id INTO remote_ts, remote_owner
      FROM question_answers a WHERE a.id = entity_id;
      IF remote_owner IS NOT NULL AND remote_owner <> uid THEN
        RAISE EXCEPTION 'question_answer belongs to another account';
      END IF;

      op_status := 'accepted';
      IF remote_ts IS NOT NULL AND (base_ts IS NULL OR remote_ts > base_ts) THEN
        op_status := 'conflict';
      END IF;

      INSERT INTO sync_operations(
        user_id, operation_id, device_id, entity_type, entity_id,
        operation_type, payload, base_revision, status)
      VALUES (
        uid, op_id, COALESCE(op->>'device_id', 'unknown'),
        'question_answer', entity_id, 'projection.upsert',
        jsonb_build_object('row', row), NULLIF(op->>'base_revision', ''),
        op_status)
      RETURNING server_sequence INTO seq;

      IF op_status = 'accepted' THEN
        INSERT INTO question_answers(
          id, user_id, question_id, choice_id, why, answered_on, in_crowd,
          created_at, updated_at, deleted_at)
        VALUES (
          entity_id, uid,
          row->>'question_id',
          row->>'choice_id',
          NULLIF(row->>'why', ''),
          (row->>'answered_on')::date,
          COALESCE((row->>'in_crowd')::boolean, true),
          COALESCE(NULLIF(row->>'created_at', '')::timestamptz, now()),
          COALESCE(NULLIF(row->>'updated_at', '')::timestamptz, now()),
          NULLIF(row->>'deleted_at', '')::timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          question_id = EXCLUDED.question_id,
          choice_id = EXCLUDED.choice_id,
          why = EXCLUDED.why,
          in_crowd = EXCLUDED.in_crowd,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at
        -- The owner was checked above; this keeps the update scoped to it too.
        -- The day never changes: the id is derived from it.
        WHERE question_answers.user_id = uid;
      END IF;

      results := results || jsonb_build_array(jsonb_build_object(
        'operation_id', op_id, 'status', op_status, 'server_sequence', seq));
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_array(jsonb_build_object(
        'operation_id',
        COALESCE(op_id, '00000000-0000-0000-0000-000000000000'),
        'status', 'error', 'server_sequence', 0, 'detail', SQLERRM));
    END;
  END LOOP;

  RETURN results;
END;
$$;

ALTER FUNCTION submit_sync_operations_ungated(JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION submit_sync_operations_ungated(JSONB)
  FROM PUBLIC, anon, authenticated;

-- pull_sync_snapshot_ungated --------------------------------------------------
-- Same body as 20261112165459_personality.sql with the new table. It is
-- replaced rather than wrapped to keep it one pass over the tables.

CREATE OR REPLACE FUNCTION pull_sync_snapshot_ungated()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '50s'
AS $$
DECLARE
  uid UUID := auth.uid();
  seq BIGINT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT COALESCE(MAX(server_sequence), 0) INTO seq
  FROM sync_operations
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'server_sequence', seq,
    'activity_groups', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM activity_groups t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'activities', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM activities t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'daily_entries', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM daily_entries t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'activity_periods', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(t))
        FROM activity_periods t
        WHERE t.user_id = uid
          AND (
            t.end_time IS NULL
            OR t.start_time IS DISTINCT FROM t.end_time
          )
      ),
      '[]'::jsonb
    ),
    'journal_entries', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM journal_entries t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'one_time_tasks', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM one_time_tasks t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'memories', COALESCE(
      (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at)
       FROM memories m WHERE m.user_id = uid),
      '[]'::jsonb
    ),
    'journal_entry_revisions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
       FROM journal_entry_revisions r WHERE r.user_id = uid),
      '[]'::jsonb
    ),
    'personality_sittings', COALESCE(
      (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.started_at)
       FROM personality_sittings s WHERE s.user_id = uid),
      '[]'::jsonb
    ),
    'journal_readings', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
       FROM journal_readings r WHERE r.user_id = uid),
      '[]'::jsonb
    ),
    'question_answers', COALESCE(
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.answered_on)
       FROM question_answers a WHERE a.user_id = uid),
      '[]'::jsonb
    )
  );
END;
$$;

ALTER FUNCTION pull_sync_snapshot_ungated() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot_ungated()
  FROM PUBLIC, anon, authenticated;

-- question_results ---------------------------------------------------------------
-- How everyone answered one question, as counts per choice.
--
--   * refused unless the caller has a live answer to this question, so the crowd
--     is a reward for answering, not something to browse;
--   * only the latest live answer of each person counts, and only if they are
--     counted in the crowd, so a question asked again a month later does not
--     count someone twice;
--   * until at least 10 people are counted, the result is { "ready": false } and
--     carries no number at all.
-- It returns choice ids and counts and never a user id, a "why" or a date.

CREATE FUNCTION question_results(p_question_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  min_people CONSTANT INT := 10;
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

REVOKE ALL ON FUNCTION question_results(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION question_results(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
