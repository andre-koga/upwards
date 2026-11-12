-- Big Five on the You page.
--
-- Two synced records, so the portrait follows the account the way a memory does:
--
--   personality_sittings  one sitting of the 50-item self-test. The row exists
--                         from the first answer; scores and completed_at stay
--                         NULL until all fifty are answered. A retake is a new
--                         row. The answers and scores never go to a model.
--   journal_readings      what the user's own model read from their recent
--                         journal days: five scores, a note and checked quotes
--                         per trait, the date span, and how many days were
--                         read. It holds no second copy of the journal.
--
-- Both are current-state rows written through submit_sync_operations, with the
-- same optimistic concurrency the compass used: a stale base is a conflict that
-- is recorded, not applied, and stays reviewable in the app.

CREATE TABLE personality_sittings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT personality_sittings_answers_object
    CHECK (jsonb_typeof(answers) = 'object' AND pg_column_size(answers) <= 4096),
  CONSTRAINT personality_sittings_scores_object
    CHECK (scores IS NULL OR (jsonb_typeof(scores) = 'object' AND pg_column_size(scores) <= 512)),
  CONSTRAINT personality_sittings_complete_has_scores
    CHECK (completed_at IS NULL OR scores IS NOT NULL OR deleted_at IS NOT NULL)
);

CREATE INDEX idx_personality_sittings_user_started
  ON personality_sittings(user_id, started_at);

CREATE TABLE journal_readings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  quotes JSONB NOT NULL DEFAULT '{}'::jsonb,
  span_start DATE NOT NULL,
  span_end DATE NOT NULL,
  days_read INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT journal_readings_scores_object
    CHECK (jsonb_typeof(scores) = 'object' AND pg_column_size(scores) <= 512),
  CONSTRAINT journal_readings_notes_object
    CHECK (jsonb_typeof(notes) = 'object' AND pg_column_size(notes) <= 8192),
  CONSTRAINT journal_readings_quotes_object
    CHECK (jsonb_typeof(quotes) = 'object' AND pg_column_size(quotes) <= 8192),
  CONSTRAINT journal_readings_span_order CHECK (span_start <= span_end),
  CONSTRAINT journal_readings_days_limit CHECK (days_read BETWEEN 1 AND 60)
);

CREATE INDEX idx_journal_readings_user_created
  ON journal_readings(user_id, created_at);

-- Writes go through submit_sync_operations (SECURITY DEFINER); the client only
-- ever reads these tables directly. The explicit grant is needed because the
-- one-off "grant on all tables" migration ran before they existed.
ALTER TABLE personality_sittings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sittings"
  ON personality_sittings FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON personality_sittings TO authenticated;

ALTER TABLE journal_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own journal readings"
  ON journal_readings FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON journal_readings TO authenticated;

-- submit_sync_operations_ungated ---------------------------------------------
-- Keep the existing body under a new name and put a branch for the two new
-- entity types in front of it. Edit THIS function when changing their behavior;
-- do not recreate the one-argument signatures.
--
--   * a stale base_revision is a conflict: the server's row is strictly NEWER
--     than the base. Compared as a real timestamp, and "newer", not
--     "different": the client collapses several offline edits into one op whose
--     base is its own previous edit, a version the server has never seen;
--   * an op with no base that meets a row that already exists is a conflict
--     too, so two devices that start from nothing are reviewed, not merged;
--   * a replay of an operation id is a duplicate and writes nothing.
-- A conflicting op is recorded but not applied. Each op runs in its own block so
-- one bad row cannot abort the batch.

ALTER FUNCTION submit_sync_operations_ungated(JSONB)
  RENAME TO submit_sync_operations_before_personality;
REVOKE ALL ON FUNCTION submit_sync_operations_before_personality(JSONB)
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
  personality_ops JSONB := '[]'::jsonb;
  other_ops JSONB := '[]'::jsonb;
  op_id UUID;
  entity_id UUID;
  entity_kind TEXT;
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
    IF op->>'entity_type' IN ('personality_sitting', 'journal_reading') THEN
      personality_ops := personality_ops || jsonb_build_array(op);
    ELSE
      other_ops := other_ops || jsonb_build_array(op);
    END IF;
  END LOOP;

  IF jsonb_array_length(other_ops) > 0 THEN
    results := submit_sync_operations_before_personality(other_ops);
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(personality_ops) LOOP
    BEGIN
      op_id := NULLIF(op->>'operation_id', '')::uuid;
      entity_id := NULLIF(op->>'entity_id', '')::uuid;
      entity_kind := op->>'entity_type';
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
      IF entity_kind = 'personality_sitting' THEN
        SELECT s.updated_at, s.user_id INTO remote_ts, remote_owner
        FROM personality_sittings s WHERE s.id = entity_id;
      ELSE
        SELECT r.updated_at, r.user_id INTO remote_ts, remote_owner
        FROM journal_readings r WHERE r.id = entity_id;
      END IF;
      IF remote_owner IS NOT NULL AND remote_owner <> uid THEN
        RAISE EXCEPTION '% belongs to another account', entity_kind;
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
        entity_kind, entity_id, 'projection.upsert',
        jsonb_build_object('row', row), NULLIF(op->>'base_revision', ''),
        op_status)
      RETURNING server_sequence INTO seq;

      IF op_status = 'accepted' THEN
        IF entity_kind = 'personality_sitting' THEN
          INSERT INTO personality_sittings(
            id, user_id, started_at, completed_at, answers, scores,
            created_at, updated_at, deleted_at)
          VALUES (
            entity_id, uid,
            COALESCE(NULLIF(row->>'started_at', '')::timestamptz, now()),
            NULLIF(row->>'completed_at', '')::timestamptz,
            CASE WHEN jsonb_typeof(row->'answers') = 'object'
                 THEN row->'answers' ELSE '{}'::jsonb END,
            CASE WHEN jsonb_typeof(row->'scores') = 'object'
                 THEN row->'scores' ELSE NULL END,
            COALESCE(NULLIF(row->>'created_at', '')::timestamptz, now()),
            COALESCE(NULLIF(row->>'updated_at', '')::timestamptz, now()),
            NULLIF(row->>'deleted_at', '')::timestamptz)
          ON CONFLICT (id) DO UPDATE SET
            completed_at = EXCLUDED.completed_at,
            answers = EXCLUDED.answers,
            scores = EXCLUDED.scores,
            updated_at = EXCLUDED.updated_at,
            deleted_at = EXCLUDED.deleted_at
          -- The owner was checked above; this keeps the update scoped to it too.
          WHERE personality_sittings.user_id = uid;
        ELSE
          INSERT INTO journal_readings(
            id, user_id, scores, notes, quotes, span_start, span_end,
            days_read, created_at, updated_at, deleted_at)
          VALUES (
            entity_id, uid,
            row->'scores',
            CASE WHEN jsonb_typeof(row->'notes') = 'object'
                 THEN row->'notes' ELSE '{}'::jsonb END,
            CASE WHEN jsonb_typeof(row->'quotes') = 'object'
                 THEN row->'quotes' ELSE '{}'::jsonb END,
            (row->>'span_start')::date,
            (row->>'span_end')::date,
            (row->>'days_read')::int,
            COALESCE(NULLIF(row->>'created_at', '')::timestamptz, now()),
            COALESCE(NULLIF(row->>'updated_at', '')::timestamptz, now()),
            NULLIF(row->>'deleted_at', '')::timestamptz)
          ON CONFLICT (id) DO UPDATE SET
            scores = EXCLUDED.scores,
            notes = EXCLUDED.notes,
            quotes = EXCLUDED.quotes,
            updated_at = EXCLUDED.updated_at,
            deleted_at = EXCLUDED.deleted_at
          WHERE journal_readings.user_id = uid;
        END IF;
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
-- 20261027161817_page_sync_pulls.sql made this one pass over the tables so a
-- new phone is not timed out by a chain of wrappers. Same body, with the two
-- new tables; it is replaced rather than wrapped to keep it one statement.

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
    )
  );
END;
$$;

ALTER FUNCTION pull_sync_snapshot_ungated() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot_ungated()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
