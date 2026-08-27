-- Restore journal entries the natural-id cutover tombstoned with no survivor.
--
-- The cutover's dedupe pass (identity-repair remapJournals) soft-deleted rows it
-- believed were superseded duplicates, then pushed those tombstones. For these
-- dates the "canonical" replacement never materialised, so the date lost its only
-- row: text, emoji, photos, and video are all still stored, but
-- journalEntryHasContent() treats a tombstoned row as absent, so the day renders
-- empty.
--
-- 20260827002646 was meant to repair this but matches a different failure mode.
-- It requires an accepted delete op whose entity_id IS DISTINCT FROM the row id
-- (the "collapsed onto the wrong row" case) and explicitly skips any row that has
-- a self-id delete op. Every affected row here has a self-id delete op, so both
-- clauses excluded all of them.
--
-- Deliberately no self-id carve-out. That clause exists to preserve genuine user
-- deletions, but the app has no user-facing journal delete: every write of
-- deleted_at on journal_entries comes from the dedupe/cutover machinery, so a
-- self-id tombstone is always machine-generated.
--
-- Restoring only rows whose (user_id, entry_date) has no live sibling keeps this
-- safe against UNIQUE(user_id, entry_date), which counts tombstoned rows, and
-- makes the migration idempotent: a second run selects nothing, because the first
-- run created the live sibling.

DO $$
DECLARE
  restored INTEGER;
  published INTEGER;
BEGIN
  CREATE TEMP TABLE restored_journal_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

  WITH restorable AS (
    SELECT je.id
    FROM journal_entries je
    WHERE je.deleted_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM journal_entries live
        WHERE live.user_id = je.user_id
          AND live.entry_date = je.entry_date
          AND live.deleted_at IS NULL
      )
  ), undeleted AS (
    UPDATE journal_entries je
    SET deleted_at = NULL,
        updated_at = now()
    FROM restorable r
    WHERE je.id = r.id
    RETURNING je.id
  )
  INSERT INTO restored_journal_ids (id)
  SELECT id FROM undeleted;

  SELECT count(*) INTO restored FROM restored_journal_ids;

  -- Republish so already-cut-over devices pick the rows back up. A device that
  -- applied the tombstone still holds it in IndexedDB, and the steady-state path
  -- never revisits the row: pull_sync_operations carries deltas, not current
  -- state.
  --
  -- device_id 'server-recovery' matters. sync-operations skips ops whose
  -- device_id matches the local device, so attributing these to the originating
  -- device would make the one device that needs the repair ignore it.
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
  JOIN restored_journal_ids r ON r.id = je.id
  WHERE je.deleted_at IS NULL;

  GET DIAGNOSTICS published = ROW_COUNT;

  RAISE NOTICE 'orphaned journal recovery: % un-deleted, % ops published',
    restored, published;
END $$;
