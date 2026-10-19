-- The compass (B5b-1). See docs/architecture/temporal-data-sync.md, "Compass".
--
-- What a person writes about who they are becoming: a north star, identity
-- words, goals, and answers they add to a knowledge map. Current state, never
-- a fact stream: edits overwrite the row, `archived_at` sets it aside,
-- `deleted_at` is a tombstone with an in-app restore. There is no DELETE
-- policy on purpose: nothing here is ever hard-deleted by the client.
--
-- This adds an entity type to the operation log and a key to the snapshot, so
-- an older build cannot apply it. The migration therefore raises
-- min_client_protocol to 4 (the client sends CLIENT_PROTOCOL = 4) and ships in
-- a coordinated migration window (product-scope.md section 4.1). No existing
-- data is converted, so data_epoch is left alone.

CREATE TABLE compass_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('north_star', 'identity', 'goal', 'knowledge')),
  text TEXT NOT NULL,
  -- Knowledge only: what was asked.
  question TEXT,
  -- Goal only: what it is measured by. Plain references, not foreign keys, so a
  -- goal can sync before the habit it points at and survives that habit being
  -- archived or deleted.
  activity_id UUID,
  group_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  -- The same limits the client enforces (lib/compass/compass.ts). A tombstone
  -- keeps whatever text it had, so a restore brings the words back.
  CONSTRAINT compass_items_text_nonempty CHECK (char_length(btrim(text)) > 0),
  CONSTRAINT compass_items_text_limit CHECK (
    char_length(text) <= CASE kind
      WHEN 'north_star' THEN 200
      WHEN 'identity' THEN 40
      WHEN 'goal' THEN 120
      ELSE 1000
    END
  ),
  CONSTRAINT compass_items_question_only_knowledge CHECK (
    question IS NULL OR (kind = 'knowledge' AND char_length(question) <= 200)
  ),
  CONSTRAINT compass_items_link_only_goal CHECK (
    (activity_id IS NULL AND group_id IS NULL) OR kind = 'goal'
  ),
  CONSTRAINT compass_items_one_link CHECK (
    activity_id IS NULL OR group_id IS NULL
  )
);

-- One north star per person, whatever id it arrives under.
CREATE UNIQUE INDEX idx_compass_items_one_north_star
  ON compass_items(user_id) WHERE kind = 'north_star';
CREATE INDEX idx_compass_items_user_kind_created
  ON compass_items(user_id, kind, created_at);

-- Read-only for the API role. The sync RPCs write as the table owner, so the
-- client never needs INSERT or UPDATE, and there is deliberately no DELETE.
-- SELECT matters: conflict review reads the other device's version straight
-- from this table, and a table created after the one-off "grant on all tables"
-- migration (20260825190200) gets no privileges unless it is granted here.
GRANT SELECT ON compass_items TO authenticated;

ALTER TABLE compass_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own compass items"
  ON compass_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own compass items"
  ON compass_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own compass items"
  ON compass_items FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- submit_sync_operations_ungated ---------------------------------------------
-- Keep the existing body under a new name and put a compass branch in front of
-- it, as the journal-revision and memory migrations did. Edit THIS function
-- when changing the behavior; do not recreate the one-argument signatures.
--
-- Compass ops are current-state upserts with optimistic concurrency:
--   * a stale base_revision is a conflict: the server's row is strictly NEWER
--     than the base. Compared as a real timestamp (the text form differs
--     between Postgres and the client's ISO string), and "newer", not
--     "different": the client collapses several offline edits into one op whose
--     base is its own previous edit, a version the server has never seen;
--   * an op with no base that meets a row that already exists is a conflict
--     too. The north star has one id on every device, so two devices that write
--     it offline both arrive with no base; the second must be reviewed, never
--     silently overwrite the first.
-- A conflicting op is recorded but not applied. Each op runs in its own block so
-- one bad row cannot abort the batch.

ALTER FUNCTION submit_sync_operations_ungated(JSONB)
  RENAME TO submit_sync_operations_before_compass;
REVOKE ALL ON FUNCTION submit_sync_operations_before_compass(JSONB)
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
  compass_ops JSONB := '[]'::jsonb;
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
    IF op->>'entity_type' = 'compass_item' THEN
      compass_ops := compass_ops || jsonb_build_array(op);
    ELSE
      other_ops := other_ops || jsonb_build_array(op);
    END IF;
  END LOOP;

  IF jsonb_array_length(other_ops) > 0 THEN
    results := submit_sync_operations_before_compass(other_ops);
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(compass_ops) LOOP
    BEGIN
      op_id := NULLIF(op->>'operation_id', '')::uuid;
      entity_id := NULLIF(op->>'entity_id', '')::uuid;
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
      SELECT c.updated_at, c.user_id INTO remote_ts, remote_owner
      FROM compass_items c WHERE c.id = entity_id;
      IF remote_owner IS NOT NULL AND remote_owner <> uid THEN
        RAISE EXCEPTION 'compass item belongs to another account';
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
        'compass_item', entity_id, 'projection.upsert',
        jsonb_build_object('row', row), NULLIF(op->>'base_revision', ''),
        op_status)
      RETURNING server_sequence INTO seq;

      IF op_status = 'accepted' THEN
        INSERT INTO compass_items(
          id, user_id, kind, text, question, activity_id, group_id,
          created_at, updated_at, archived_at, deleted_at)
        VALUES (
          entity_id, uid, row->>'kind', row->>'text',
          NULLIF(row->>'question', ''),
          NULLIF(row->>'activity_id', '')::uuid,
          NULLIF(row->>'group_id', '')::uuid,
          COALESCE(NULLIF(row->>'created_at', '')::timestamptz, now()),
          COALESCE(NULLIF(row->>'updated_at', '')::timestamptz, now()),
          NULLIF(row->>'archived_at', '')::timestamptz,
          NULLIF(row->>'deleted_at', '')::timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          text = EXCLUDED.text,
          question = EXCLUDED.question,
          activity_id = EXCLUDED.activity_id,
          group_id = EXCLUDED.group_id,
          updated_at = EXCLUDED.updated_at,
          archived_at = EXCLUDED.archived_at,
          deleted_at = EXCLUDED.deleted_at
        -- The owner was checked above; this keeps the update scoped to it too.
        WHERE compass_items.user_id = uid;
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

ALTER FUNCTION pull_sync_snapshot_ungated()
  RENAME TO pull_sync_snapshot_before_compass;
REVOKE ALL ON FUNCTION pull_sync_snapshot_before_compass()
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION pull_sync_snapshot_ungated()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN pull_sync_snapshot_before_compass() || jsonb_build_object(
    'compass_items',
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at)
       FROM compass_items c WHERE c.user_id = uid),
      '[]'::jsonb));
END;
$$;

ALTER FUNCTION pull_sync_snapshot_ungated() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot_ungated()
  FROM PUBLIC, anon, authenticated;

-- Turn away builds that cannot apply compass operations. -----------------------

UPDATE app_config
SET min_client_protocol = 4
WHERE min_client_protocol < 4;

NOTIFY pgrst, 'reload schema';
