-- Temporal sync: definition version tables + operation stream with server_sequence.
-- Replaces client-clock LWW as conflict authority for semantic operations.
-- Projection tables continue to sync for compatibility during the dual-write window.

-- ─── Activity definition versions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_definition_versions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  parent_version_id UUID REFERENCES activity_definition_versions(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  server_sequence BIGINT,
  operation_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  name TEXT,
  routine TEXT,
  completion_target INTEGER,
  group_id UUID REFERENCES activity_groups(id) ON DELETE SET NULL,
  order_index INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_definition_versions_user_id
  ON activity_definition_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_definition_versions_activity_id
  ON activity_definition_versions(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_definition_versions_effective_from
  ON activity_definition_versions(activity_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_activity_definition_versions_server_updated_at
  ON activity_definition_versions(user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_activity_definition_versions_server_sequence
  ON activity_definition_versions(user_id, server_sequence);

DROP TRIGGER IF EXISTS trg_activity_definition_versions_server_updated_at
  ON activity_definition_versions;
CREATE TRIGGER trg_activity_definition_versions_server_updated_at
  BEFORE INSERT OR UPDATE ON activity_definition_versions
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

ALTER TABLE activity_definition_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity definition versions"
  ON activity_definition_versions;
DROP POLICY IF EXISTS "Users can insert their own activity definition versions"
  ON activity_definition_versions;
DROP POLICY IF EXISTS "Users can update their own activity definition versions"
  ON activity_definition_versions;
DROP POLICY IF EXISTS "Users can delete their own activity definition versions"
  ON activity_definition_versions;

CREATE POLICY "Users can view their own activity definition versions"
  ON activity_definition_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity definition versions"
  ON activity_definition_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activity definition versions"
  ON activity_definition_versions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activity definition versions"
  ON activity_definition_versions FOR DELETE USING (auth.uid() = user_id);

-- ─── Group definition versions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_definition_versions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES activity_groups(id) ON DELETE CASCADE,
  parent_version_id UUID REFERENCES group_definition_versions(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  server_sequence BIGINT,
  operation_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  order_index INTEGER,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_group_definition_versions_user_id
  ON group_definition_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_definition_versions_group_id
  ON group_definition_versions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_definition_versions_effective_from
  ON group_definition_versions(group_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_group_definition_versions_server_updated_at
  ON group_definition_versions(user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_group_definition_versions_server_sequence
  ON group_definition_versions(user_id, server_sequence);

DROP TRIGGER IF EXISTS trg_group_definition_versions_server_updated_at
  ON group_definition_versions;
CREATE TRIGGER trg_group_definition_versions_server_updated_at
  BEFORE INSERT OR UPDATE ON group_definition_versions
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

ALTER TABLE group_definition_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own group definition versions"
  ON group_definition_versions;
DROP POLICY IF EXISTS "Users can insert their own group definition versions"
  ON group_definition_versions;
DROP POLICY IF EXISTS "Users can update their own group definition versions"
  ON group_definition_versions;
DROP POLICY IF EXISTS "Users can delete their own group definition versions"
  ON group_definition_versions;

CREATE POLICY "Users can view their own group definition versions"
  ON group_definition_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own group definition versions"
  ON group_definition_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own group definition versions"
  ON group_definition_versions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own group definition versions"
  ON group_definition_versions FOR DELETE USING (auth.uid() = user_id);

-- ─── Sync operations stream (authoritative order) ────────────────────────────

CREATE SEQUENCE IF NOT EXISTS sync_operations_server_sequence_seq;

CREATE TABLE IF NOT EXISTS sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  operation_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_revision TEXT,
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'conflict', 'duplicate')),
  conflict_of UUID,
  server_sequence BIGINT NOT NULL DEFAULT nextval('sync_operations_server_sequence_seq'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_user_sequence
  ON sync_operations(user_id, server_sequence);
CREATE INDEX IF NOT EXISTS idx_sync_operations_entity
  ON sync_operations(user_id, entity_type, entity_id);

ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sync operations"
  ON sync_operations;
DROP POLICY IF EXISTS "Users can insert their own sync operations"
  ON sync_operations;

CREATE POLICY "Users can view their own sync operations"
  ON sync_operations FOR SELECT USING (auth.uid() = user_id);
-- Inserts go through the RPC (security definer) so clients don't bypass conflict checks.
CREATE POLICY "Users can insert their own sync operations"
  ON sync_operations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── submit_sync_operations ──────────────────────────────────────────────────
-- Accepts a JSON array of pending operations. Dedupes by operation_id.
-- Definition updates with a stale base_revision are recorded as conflicts.
-- Count/pause/break ops merge into daily_entries projections.

CREATE OR REPLACE FUNCTION submit_sync_operations(ops JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  op JSONB;
  results JSONB := '[]'::jsonb;
  existing_id UUID;
  existing_seq BIGINT;
  new_seq BIGINT;
  op_id UUID;
  entity_type TEXT;
  entity_id UUID;
  operation_type TEXT;
  base_revision TEXT;
  device_id TEXT;
  payload JSONB;
  latest_version_id UUID;
  status TEXT;
  daily_date DATE;
  activity_uuid UUID;
  delta INT;
  entry_id UUID;
  counts JSONB;
  paused JSONB;
  prev_count INT;
  next_count INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF ops IS NULL OR jsonb_typeof(ops) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(ops)
  LOOP
    op_id := NULLIF(op->>'operation_id', '')::UUID;
    IF op_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT so.id, so.server_sequence INTO existing_id, existing_seq
    FROM sync_operations so
    WHERE so.user_id = uid AND so.operation_id = op_id;

    IF existing_id IS NOT NULL THEN
      results := results || jsonb_build_array(jsonb_build_object(
        'operation_id', op_id,
        'status', 'duplicate',
        'server_sequence', existing_seq
      ));
      CONTINUE;
    END IF;

    entity_type := COALESCE(op->>'entity_type', '');
    entity_id := NULLIF(op->>'entity_id', '')::UUID;
    operation_type := COALESCE(op->>'operation_type', '');
    base_revision := NULLIF(op->>'base_revision', '');
    device_id := COALESCE(op->>'device_id', 'unknown');
    payload := COALESCE(op->'payload', '{}'::jsonb);
    status := 'accepted';

    -- Definition conflict detection: concurrent edits from the same parent.
    IF entity_type IN ('activity_definition', 'group_definition')
       AND operation_type = 'definition.update'
       AND base_revision IS NOT NULL THEN
      IF entity_type = 'activity_definition' THEN
        SELECT adv.id INTO latest_version_id
        FROM activity_definition_versions adv
        WHERE adv.user_id = uid
          AND adv.activity_id = entity_id
          AND adv.deleted_at IS NULL
        ORDER BY adv.effective_from DESC, adv.recorded_at DESC
        LIMIT 1;
      ELSE
        SELECT gdv.id INTO latest_version_id
        FROM group_definition_versions gdv
        WHERE gdv.user_id = uid
          AND gdv.group_id = entity_id
          AND gdv.deleted_at IS NULL
        ORDER BY gdv.effective_from DESC, gdv.recorded_at DESC
        LIMIT 1;
      END IF;

      IF latest_version_id IS NOT NULL
         AND latest_version_id::TEXT <> base_revision THEN
        status := 'conflict';
      END IF;
    END IF;

    INSERT INTO sync_operations (
      user_id, operation_id, device_id, entity_type, entity_id,
      operation_type, payload, base_revision, status
    ) VALUES (
      uid, op_id, device_id, entity_type, entity_id,
      operation_type, payload, base_revision, status
    )
    RETURNING server_sequence INTO new_seq;

    -- Apply accepted definition versions to the version table + projection.
    IF status = 'accepted' AND entity_type = 'activity_definition'
       AND operation_type IN ('definition.create', 'definition.update') THEN
      INSERT INTO activity_definition_versions (
        id, user_id, activity_id, parent_version_id, effective_from, recorded_at,
        server_sequence, operation_id, device_id, name, routine, completion_target,
        group_id, order_index, schema_version, created_at, deleted_at
      ) VALUES (
        COALESCE(NULLIF(payload->>'version_id', '')::UUID, gen_random_uuid()),
        uid,
        entity_id,
        NULLIF(payload->>'parent_version_id', '')::UUID,
        COALESCE(NULLIF(payload->>'effective_from', '')::DATE, CURRENT_DATE),
        COALESCE(NULLIF(payload->>'recorded_at', '')::TIMESTAMPTZ, now()),
        new_seq,
        op_id,
        device_id,
        payload->'fields'->>'name',
        payload->'fields'->>'routine',
        NULLIF(payload->'fields'->>'completion_target', '')::INTEGER,
        NULLIF(payload->'fields'->>'group_id', '')::UUID,
        NULLIF(payload->'fields'->>'order_index', '')::INTEGER,
        COALESCE(NULLIF(payload->>'schema_version', '')::INTEGER, 1),
        now(),
        NULL
      )
      ON CONFLICT (id) DO NOTHING;

      -- Update projection only when this version applies today or earlier.
      IF COALESCE(NULLIF(payload->>'effective_from', '')::DATE, CURRENT_DATE) <= CURRENT_DATE THEN
        UPDATE activities
        SET
          name = COALESCE(payload->'fields'->>'name', name),
          routine = COALESCE(payload->'fields'->>'routine', routine),
          completion_target = COALESCE(
            NULLIF(payload->'fields'->>'completion_target', '')::INTEGER,
            completion_target
          ),
          group_id = COALESCE(
            NULLIF(payload->'fields'->>'group_id', '')::UUID,
            group_id
          ),
          order_index = COALESCE(
            NULLIF(payload->'fields'->>'order_index', '')::INTEGER,
            order_index
          ),
          updated_at = now()
        WHERE id = entity_id AND user_id = uid;
      END IF;
    END IF;

    IF status = 'accepted' AND entity_type = 'group_definition'
       AND operation_type IN ('definition.create', 'definition.update') THEN
      INSERT INTO group_definition_versions (
        id, user_id, group_id, parent_version_id, effective_from, recorded_at,
        server_sequence, operation_id, device_id, name, color, order_index,
        schema_version, created_at, deleted_at
      ) VALUES (
        COALESCE(NULLIF(payload->>'version_id', '')::UUID, gen_random_uuid()),
        uid,
        entity_id,
        NULLIF(payload->>'parent_version_id', '')::UUID,
        COALESCE(NULLIF(payload->>'effective_from', '')::DATE, CURRENT_DATE),
        COALESCE(NULLIF(payload->>'recorded_at', '')::TIMESTAMPTZ, now()),
        new_seq,
        op_id,
        device_id,
        COALESCE(payload->'fields'->>'name', 'Group'),
        payload->'fields'->>'color',
        NULLIF(payload->'fields'->>'order_index', '')::INTEGER,
        COALESCE(NULLIF(payload->>'schema_version', '')::INTEGER, 1),
        now(),
        NULL
      )
      ON CONFLICT (id) DO NOTHING;

      IF COALESCE(NULLIF(payload->>'effective_from', '')::DATE, CURRENT_DATE) <= CURRENT_DATE THEN
        UPDATE activity_groups
        SET
          name = COALESCE(payload->'fields'->>'name', name),
          color = COALESCE(payload->'fields'->>'color', color),
          order_index = COALESCE(
            NULLIF(payload->'fields'->>'order_index', '')::INTEGER,
            order_index
          ),
          updated_at = now()
        WHERE id = entity_id AND user_id = uid;
      END IF;
    END IF;

    -- Semantic daily_entry merges (idempotent by operation_id via sync_operations).
    IF status = 'accepted' AND entity_type = 'daily_entry' THEN
      daily_date := NULLIF(payload->>'date', '')::DATE;
      activity_uuid := NULLIF(payload->>'activity_id', '')::UUID;

      IF daily_date IS NOT NULL THEN
        SELECT de.id, COALESCE(de.task_counts, '{}'::jsonb), COALESCE(de.paused_task_ids, '[]'::jsonb)
        INTO entry_id, counts, paused
        FROM daily_entries de
        WHERE de.user_id = uid AND de.date = daily_date AND de.deleted_at IS NULL
        LIMIT 1;

        IF entry_id IS NULL THEN
          entry_id := gen_random_uuid();
          counts := '{}'::jsonb;
          paused := '[]'::jsonb;
          INSERT INTO daily_entries (
            id, user_id, date, task_counts, paused_task_ids, is_break_day,
            current_activity_id, created_at, updated_at
          ) VALUES (
            entry_id, uid, daily_date, counts, paused, false,
            NULL, now(), now()
          );
        END IF;

        IF operation_type = 'count.delta' AND activity_uuid IS NOT NULL THEN
          delta := COALESCE((payload->>'delta')::INT, 0);
          prev_count := COALESCE((counts->>activity_uuid::TEXT)::INT, 0);
          next_count := GREATEST(0, prev_count + delta);
          IF next_count = 0 THEN
            counts := counts - activity_uuid::TEXT;
          ELSE
            counts := jsonb_set(counts, ARRAY[activity_uuid::TEXT], to_jsonb(next_count), true);
          END IF;
          UPDATE daily_entries
          SET task_counts = counts, updated_at = now()
          WHERE id = entry_id;
        ELSIF operation_type = 'pause.enable' AND activity_uuid IS NOT NULL THEN
          IF NOT (paused @> jsonb_build_array(activity_uuid::TEXT)) THEN
            paused := paused || jsonb_build_array(activity_uuid::TEXT);
          END IF;
          UPDATE daily_entries
          SET paused_task_ids = paused, updated_at = now()
          WHERE id = entry_id;
        ELSIF operation_type = 'pause.disable' AND activity_uuid IS NOT NULL THEN
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          INTO paused
          FROM jsonb_array_elements_text(paused) AS elem
          WHERE elem <> activity_uuid::TEXT;
          UPDATE daily_entries
          SET paused_task_ids = COALESCE(paused, '[]'::jsonb), updated_at = now()
          WHERE id = entry_id;
        ELSIF operation_type = 'break_day.enable' THEN
          UPDATE daily_entries
          SET is_break_day = true, updated_at = now()
          WHERE id = entry_id;
        ELSIF operation_type = 'break_day.disable' THEN
          UPDATE daily_entries
          SET is_break_day = false, updated_at = now()
          WHERE id = entry_id;
        END IF;
      END IF;
    END IF;

    results := results || jsonb_build_array(jsonb_build_object(
      'operation_id', op_id,
      'status', status,
      'server_sequence', new_seq
    ));
  END LOOP;

  RETURN results;
END;
$$;

REVOKE ALL ON FUNCTION submit_sync_operations(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_sync_operations(JSONB) TO authenticated;

-- Pull operations after a given sequence (exclusive).
CREATE OR REPLACE FUNCTION pull_sync_operations(since_sequence BIGINT DEFAULT 0)
RETURNS SETOF sync_operations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM sync_operations
  WHERE user_id = auth.uid()
    AND server_sequence > COALESCE(since_sequence, 0)
  ORDER BY server_sequence ASC;
$$;

REVOKE ALL ON FUNCTION pull_sync_operations(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pull_sync_operations(BIGINT) TO authenticated;
