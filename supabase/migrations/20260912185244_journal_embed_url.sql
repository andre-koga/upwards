-- Journal entries can store a single share/embed URL (Spotify, YouTube, etc.).
-- The client allowlists providers before rendering an iframe.
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS embed_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journal_entries_embed_url_limit'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT journal_entries_embed_url_limit
      CHECK (embed_url IS NULL OR char_length(embed_url) <= 500);
  END IF;
END $$;

-- submit_sync_operations currently inserts journal rows without embed_url.
-- Wrap it so accepted journal ops that include the field persist it, while older
-- clients that omit the key leave the existing value untouched.
ALTER FUNCTION submit_sync_operations(JSONB) RENAME TO submit_sync_operations_pre_embed;

CREATE FUNCTION submit_sync_operations(ops JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  op JSONB;
  row JSONB;
  results JSONB;
  op_id TEXT;
  status TEXT;
  entry_date TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  results := submit_sync_operations_pre_embed(ops);

  FOR op IN SELECT * FROM jsonb_array_elements(COALESCE(ops, '[]'::jsonb)) LOOP
    IF op->>'entity_type' IS DISTINCT FROM 'journal_entry' THEN
      CONTINUE;
    END IF;
    row := COALESCE(op->'payload'->'row', '{}'::jsonb);
    IF NOT (row ? 'embed_url') THEN
      CONTINUE;
    END IF;
    op_id := op->>'operation_id';
    SELECT r->>'status' INTO status
    FROM jsonb_array_elements(COALESCE(results, '[]'::jsonb)) AS r
    WHERE r->>'operation_id' = op_id
    LIMIT 1;
    IF status IS DISTINCT FROM 'accepted' THEN
      CONTINUE;
    END IF;
    entry_date := NULLIF(row->>'entry_date', '');
    IF entry_date IS NULL THEN
      CONTINUE;
    END IF;
    UPDATE journal_entries
    SET embed_url = NULLIF(BTRIM(row->>'embed_url'), '')
    WHERE user_id = uid
      AND journal_entries.entry_date = entry_date;
  END LOOP;

  RETURN results;
END;
$$;

ALTER FUNCTION submit_sync_operations(JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION submit_sync_operations(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_sync_operations(JSONB) TO authenticated;
