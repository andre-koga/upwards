-- Recalled experiences are separate current-state rows: they are not daily journal facts.
-- Only a free-text "when" label is captured for now; no structured date range.
CREATE TABLE memories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_content TEXT,
  photo_paths TEXT[],
  time_label TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT memories_nonempty_content CHECK (
    NULLIF(BTRIM(text_content), '') IS NOT NULL
    OR COALESCE(cardinality(photo_paths), 0) > 0
    OR deleted_at IS NOT NULL
  ),
  CONSTRAINT memories_text_limit CHECK (text_content IS NULL OR char_length(text_content) <= 300),
  CONSTRAINT memories_photo_limit CHECK (COALESCE(cardinality(photo_paths), 0) <= 8)
);
CREATE INDEX idx_memories_user_deleted_created ON memories(user_id, deleted_at, created_at);
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own memories" ON memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own memories" ON memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own memories" ON memories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Preserve the established RPC for existing entities and add an OCC-aware memory branch.
-- Each memory op runs in its own BEGIN/EXCEPTION block (mirroring the isolation
-- submit_sync_operations_existing already gives every other entity type) so one bad
-- memory op cannot abort the other_ops batch already applied in this same call.
ALTER FUNCTION submit_sync_operations(JSONB) RENAME TO submit_sync_operations_existing;
CREATE FUNCTION submit_sync_operations(ops JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); op JSONB; row JSONB; results JSONB := '[]'::jsonb;
  memory_ops JSONB := '[]'::jsonb; other_ops JSONB := '[]'::jsonb; op_id UUID; entity_id UUID;
  base_revision TEXT; remote_updated TEXT; status TEXT; seq BIGINT; existing_seq BIGINT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  FOR op IN SELECT * FROM jsonb_array_elements(COALESCE(ops, '[]'::jsonb)) LOOP
    IF op->>'entity_type' = 'memory' THEN memory_ops := memory_ops || jsonb_build_array(op); ELSE other_ops := other_ops || jsonb_build_array(op); END IF;
  END LOOP;
  IF jsonb_array_length(other_ops) > 0 THEN results := submit_sync_operations_existing(other_ops); END IF;
  FOR op IN SELECT * FROM jsonb_array_elements(memory_ops) LOOP
    BEGIN
      op_id := NULLIF(op->>'operation_id', '')::uuid; entity_id := NULLIF(op->>'entity_id', '')::uuid;
      IF op_id IS NULL OR entity_id IS NULL OR op->>'operation_type' <> 'projection.upsert' THEN CONTINUE; END IF;
      SELECT server_sequence INTO existing_seq FROM sync_operations WHERE user_id = uid AND operation_id = op_id;
      IF existing_seq IS NOT NULL THEN results := results || jsonb_build_array(jsonb_build_object('operation_id', op_id, 'status', 'duplicate', 'server_sequence', existing_seq)); CONTINUE; END IF;
      row := COALESCE(op->'payload'->'row', '{}'::jsonb); base_revision := NULLIF(op->>'base_revision', ''); status := 'accepted';
      SELECT updated_at::text INTO remote_updated FROM memories WHERE user_id = uid AND id = entity_id;
      IF base_revision IS NOT NULL AND remote_updated IS NOT NULL AND remote_updated IS DISTINCT FROM base_revision THEN status := 'conflict'; END IF;
      INSERT INTO sync_operations(user_id, operation_id, device_id, entity_type, entity_id, operation_type, payload, base_revision, status)
      VALUES(uid, op_id, COALESCE(op->>'device_id', 'unknown'), 'memory', entity_id, 'projection.upsert', jsonb_build_object('row', row), base_revision, status)
      RETURNING server_sequence INTO seq;
      IF status = 'accepted' THEN
        INSERT INTO memories(id, user_id, text_content, photo_paths, time_label, created_at, updated_at, deleted_at)
        VALUES(entity_id, uid, row->>'text_content', CASE WHEN jsonb_typeof(row->'photo_paths') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(row->'photo_paths')) ELSE NULL END, row->>'time_label', COALESCE(NULLIF(row->>'created_at', '')::timestamptz, now()), COALESCE(NULLIF(row->>'updated_at', '')::timestamptz, now()), NULLIF(row->>'deleted_at', '')::timestamptz)
        ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content, photo_paths = EXCLUDED.photo_paths, time_label = EXCLUDED.time_label, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at;
      END IF;
      results := results || jsonb_build_array(jsonb_build_object('operation_id', op_id, 'status', status, 'server_sequence', seq));
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_array(jsonb_build_object('operation_id', COALESCE(op_id, '00000000-0000-0000-0000-000000000000'), 'status', 'error', 'server_sequence', 0, 'detail', SQLERRM));
    END;
  END LOOP;
  RETURN results;
END; $$;
ALTER FUNCTION submit_sync_operations(JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION submit_sync_operations(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_sync_operations(JSONB) TO authenticated;

ALTER FUNCTION pull_sync_snapshot() RENAME TO pull_sync_snapshot_existing;
CREATE FUNCTION pull_sync_snapshot() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  RETURN pull_sync_snapshot_existing() || jsonb_build_object('memories', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM memories m WHERE m.user_id = uid), '[]'::jsonb));
END; $$;
ALTER FUNCTION pull_sync_snapshot() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pull_sync_snapshot() TO authenticated;
