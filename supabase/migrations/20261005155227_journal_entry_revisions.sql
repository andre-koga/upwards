-- Journal revisions (A5). See docs/architecture/product-scope.md §2.3 and
-- temporal-data-sync.md.
--
-- When a confirmed edit overwrites an old journal day's title, emoji, text, or
-- media list, the previous values are kept as an append-only revision. Rows are
-- inserted once and never updated or deleted (no UPDATE/DELETE policy). The
-- revision carries the entry's date, not a foreign key, because the journal is
-- keyed by (user_id, entry_date). Storage objects a revision references must
-- not be deleted by the client.

CREATE TABLE journal_entry_revisions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL CHECK (entry_date ~ '^\d{4}-\d{2}-\d{2}$'),
  title TEXT,
  day_emoji TEXT,
  text_content TEXT,
  photo_paths TEXT[],
  video_path TEXT,
  video_thumbnail TEXT,
  -- When the previous values were replaced. updated_at mirrors it so the row
  -- has the same shape as every other synced row.
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT journal_entry_revisions_photo_limit
    CHECK (COALESCE(cardinality(photo_paths), 0) <= 8)
);

CREATE INDEX idx_journal_entry_revisions_user_date
  ON journal_entry_revisions(user_id, entry_date, created_at);

ALTER TABLE journal_entry_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own journal revisions"
  ON journal_entry_revisions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own journal revisions"
  ON journal_entry_revisions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- submit_sync_operations_ungated ---------------------------------------------
-- Keep the existing body under a new name and put a thin revision branch in
-- front of it. Revision ops are append-only: a replay inserts nothing and is
-- reported as a duplicate, and there is no base_revision to conflict on. Each
-- op runs in its own block so one bad revision cannot abort the batch.

ALTER FUNCTION submit_sync_operations_ungated(JSONB)
  RENAME TO submit_sync_operations_before_revisions;
REVOKE ALL ON FUNCTION submit_sync_operations_before_revisions(JSONB)
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
  revision_ops JSONB := '[]'::jsonb;
  other_ops JSONB := '[]'::jsonb;
  op_id UUID;
  entity_id UUID;
  seq BIGINT;
  existing_seq BIGINT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(COALESCE(ops, '[]'::jsonb)) LOOP
    IF op->>'entity_type' = 'journal_entry_revision' THEN
      revision_ops := revision_ops || jsonb_build_array(op);
    ELSE
      other_ops := other_ops || jsonb_build_array(op);
    END IF;
  END LOOP;

  IF jsonb_array_length(other_ops) > 0 THEN
    results := submit_sync_operations_before_revisions(other_ops);
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(revision_ops) LOOP
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

      INSERT INTO sync_operations(
        user_id, operation_id, device_id, entity_type, entity_id,
        operation_type, payload, base_revision, status)
      VALUES (
        uid, op_id, COALESCE(op->>'device_id', 'unknown'),
        'journal_entry_revision', entity_id, 'projection.upsert',
        jsonb_build_object('row', row), NULL, 'accepted')
      RETURNING server_sequence INTO seq;

      INSERT INTO journal_entry_revisions(
        id, user_id, entry_date, title, day_emoji, text_content,
        photo_paths, video_path, video_thumbnail, created_at, updated_at)
      VALUES (
        entity_id, uid, row->>'entry_date', row->>'title', row->>'day_emoji',
        row->>'text_content',
        CASE WHEN jsonb_typeof(row->'photo_paths') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(row->'photo_paths'))
          ELSE NULL END,
        row->>'video_path', row->>'video_thumbnail',
        COALESCE(NULLIF(row->>'created_at', '')::timestamptz, now()),
        COALESCE(NULLIF(row->>'updated_at', '')::timestamptz, now()))
      ON CONFLICT (id) DO NOTHING;

      results := results || jsonb_build_array(jsonb_build_object(
        'operation_id', op_id, 'status', 'accepted', 'server_sequence', seq));
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
  RENAME TO pull_sync_snapshot_before_revisions;
REVOKE ALL ON FUNCTION pull_sync_snapshot_before_revisions()
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
  RETURN pull_sync_snapshot_before_revisions() || jsonb_build_object(
    'journal_entry_revisions',
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
       FROM journal_entry_revisions r WHERE r.user_id = uid),
      '[]'::jsonb));
END;
$$;

ALTER FUNCTION pull_sync_snapshot_ungated() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot_ungated()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
