-- Recover journal entries soft-deleted by the natural-id cutover.
--
-- journal_entries is UNIQUE(user_id, entry_date), and the previous
-- submit_sync_operations redirected every journal projection.upsert onto the
-- row matching entry_date. When the cutover swept a locally soft-deleted
-- duplicate into the op queue, that delete collapsed onto the surviving row
-- and set deleted_at on real content.
--
-- Distinguishing an accidental clobber from a genuine user delete:
--   * genuine delete  -> the deleting op's entity_id equals the row's id
--   * cutover clobber -> the deleting op's entity_id is some other id that was
--                        redirected onto this row by entry_date
-- Only the second case is restored here, so entries deleted on purpose stay
-- deleted.
--
-- Text is also recovered from the op log when the surviving row was
-- overwritten by an emptier duplicate: sync_operations retains every pushed
-- payload verbatim, so the richest non-empty text for that date is available.
--
-- Idempotent: re-running restores nothing new because restored rows are no
-- longer soft-deleted.

DO $$
DECLARE
  restored INT := 0;
  refilled INT := 0;
BEGIN
  -- Rows whose deletion came from a redirected op (never from their own id).
  WITH clobbered AS (
    SELECT je.id, je.user_id, je.entry_date
    FROM journal_entries je
    WHERE je.deleted_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM sync_operations so
        WHERE so.user_id = je.user_id
          AND so.entity_type = 'journal_entry'
          AND so.operation_type = 'projection.upsert'
          AND so.status = 'accepted'
          AND so.payload->'row'->>'entry_date' = je.entry_date
          AND NULLIF(so.payload->'row'->>'deleted_at', '') IS NOT NULL
          AND so.entity_id IS DISTINCT FROM je.id
      )
      AND NOT EXISTS (
        -- The user never deleted this exact row themselves.
        SELECT 1
        FROM sync_operations so
        WHERE so.user_id = je.user_id
          AND so.entity_type = 'journal_entry'
          AND so.operation_type = 'projection.upsert'
          AND so.status = 'accepted'
          AND so.entity_id = je.id
          AND NULLIF(so.payload->'row'->>'deleted_at', '') IS NOT NULL
      )
  )
  UPDATE journal_entries je
  SET deleted_at = NULL,
      updated_at = now()
  FROM clobbered c
  WHERE je.id = c.id;

  GET DIAGNOSTICS restored = ROW_COUNT;

  -- Recover text that an emptier duplicate overwrote, using the richest
  -- non-empty payload recorded for that date.
  WITH best_text AS (
    SELECT DISTINCT ON (so.user_id, so.payload->'row'->>'entry_date')
      so.user_id,
      so.payload->'row'->>'entry_date' AS entry_date,
      so.payload->'row'->>'text_content' AS text_content,
      so.payload->'row'->>'title' AS title
    FROM sync_operations so
    WHERE so.entity_type = 'journal_entry'
      AND so.operation_type = 'projection.upsert'
      AND so.status = 'accepted'
      AND NULLIF(so.payload->'row'->>'deleted_at', '') IS NULL
      AND length(COALESCE(so.payload->'row'->>'text_content', '')) > 0
    ORDER BY
      so.user_id,
      so.payload->'row'->>'entry_date',
      length(COALESCE(so.payload->'row'->>'text_content', '')) DESC,
      so.server_sequence DESC
  )
  UPDATE journal_entries je
  SET text_content = bt.text_content,
      title = COALESCE(NULLIF(je.title, ''), bt.title),
      updated_at = now()
  FROM best_text bt
  WHERE je.user_id = bt.user_id
    AND je.entry_date = bt.entry_date
    AND je.deleted_at IS NULL
    AND length(COALESCE(je.text_content, '')) = 0
    AND length(COALESCE(bt.text_content, '')) > 0;

  GET DIAGNOSTICS refilled = ROW_COUNT;

  RAISE NOTICE 'journal recovery: % entries un-deleted, % text bodies refilled',
    restored, refilled;
END $$;
