-- Recover journal entries soft-deleted by the natural-id cutover, and publish
-- the restores to the operation stream so devices actually see them.
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
-- Publishing matters: clients finish the v2 bootstrap once and from then on
-- read journal rows only from pull_sync_operations. A bare UPDATE here would
-- heal Postgres while every already-cut-over device kept showing the entry as
-- deleted. Emitting an accepted projection.upsert per restored row makes the
-- normal pull deliver it. device_id is a synthetic 'server-recovery' because
-- pullAndApplyOperations skips ops authored by the local device.
--
-- Idempotent: restored rows are no longer soft-deleted, so a re-run selects
-- nothing and emits no further ops.

DO $$
DECLARE
  restored INT := 0;
  refilled INT := 0;
  published INT := 0;
BEGIN
  CREATE TEMP TABLE recovered_journal_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

  -- 1. Un-delete rows whose deletion came from a redirected op.
  WITH clobbered AS (
    SELECT je.id
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
  ), undeleted AS (
    UPDATE journal_entries je
    SET deleted_at = NULL,
        updated_at = now()
    FROM clobbered c
    WHERE je.id = c.id
    RETURNING je.id
  )
  INSERT INTO recovered_journal_ids (id)
  SELECT id FROM undeleted
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO restored FROM recovered_journal_ids;

  -- 2. Refill text an emptier duplicate overwrote, using the richest non-empty
  --    payload recorded for that date.
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
  ), refilled_rows AS (
    UPDATE journal_entries je
    SET text_content = bt.text_content,
        title = COALESCE(NULLIF(je.title, ''), bt.title),
        updated_at = now()
    FROM best_text bt
    WHERE je.user_id = bt.user_id
      AND je.entry_date = bt.entry_date
      AND je.deleted_at IS NULL
      AND length(COALESCE(je.text_content, '')) = 0
      AND length(COALESCE(bt.text_content, '')) > 0
    RETURNING je.id
  )
  INSERT INTO recovered_journal_ids (id)
  SELECT id FROM refilled_rows
  ON CONFLICT DO NOTHING;

  SELECT count(*) - restored INTO refilled FROM recovered_journal_ids;

  -- 3. Publish each recovered row so already-cut-over devices pick it up.
  INSERT INTO sync_operations (
    user_id, operation_id, device_id, entity_type, entity_id,
    operation_type, payload, base_revision, status
  )
  SELECT
    je.user_id,
    gen_random_uuid(),
    'server-recovery',
    'journal_entry',
    je.id,
    'projection.upsert',
    jsonb_build_object('row', jsonb_build_object(
      'id', je.id,
      'entry_date', je.entry_date,
      'title', je.title,
      'text_content', je.text_content,
      'day_emoji', je.day_emoji,
      'is_bookmarked', je.is_bookmarked,
      'video_path', je.video_path,
      'video_thumbnail', je.video_thumbnail,
      'photo_paths', to_jsonb(je.photo_paths),
      'is_journal_complete', je.is_journal_complete,
      'journal_entry_number', je.journal_entry_number,
      'journal_completion_streak', je.journal_completion_streak,
      'journal_completed_at', je.journal_completed_at,
      'location', je.location,
      'created_at', je.created_at,
      'updated_at', je.updated_at,
      'deleted_at', NULL
    )),
    NULL,
    'accepted'
  FROM journal_entries je
  JOIN recovered_journal_ids r ON r.id = je.id
  WHERE je.deleted_at IS NULL;

  GET DIAGNOSTICS published = ROW_COUNT;

  RAISE NOTICE 'journal recovery: % un-deleted, % text refilled, % ops published',
    restored, refilled, published;
END $$;
