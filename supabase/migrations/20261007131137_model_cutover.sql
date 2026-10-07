-- Model cutover (A6a). See docs/architecture/product-scope.md §2.1, §2.2, §2.10.
--
-- Converts the data to the new model and turns away old clients. This is the
-- server half of a migration WINDOW: merge it together with the client release
-- (A6b), after every device is synced and a backup has been taken (§4.1).
--
-- Layout:
--   1. New columns.
--   2. cutover_a6_convert(): the data conversion, one idempotent step at a time.
--   3. Retire the old shapes: read-only tables, the wrapped sync RPC.
--   4. Run the conversion and raise the gates.

-- ─── 1. New columns ──────────────────────────────────────────────────────────

ALTER TABLE activities
  -- When false the activity has no timer and never owns sessions (§2.1).
  ADD COLUMN IF NOT EXISTS tracks_time BOOLEAN NOT NULL DEFAULT TRUE,
  -- The user's override of AI ordering (§2.1). The control arrives in B2.
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  -- Archive is a timestamp, not an event log (§2.10).
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE activity_groups
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ─── 2. The conversion ───────────────────────────────────────────────────────
--
-- Each step only touches rows that still need it, so running the whole function
-- twice in a row changes nothing the second time. Nothing is hard-deleted: a
-- deleted item gets `deleted_at`, and the old event and memo tables are kept.

CREATE OR REPLACE FUNCTION cutover_a6_convert()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_arch_act INT; n_arch_grp INT; n_del_act INT; n_del_grp INT;
  n_hidden_named INT; n_hidden_deleted INT; n_avoid INT;
  n_memo_groups INT; n_memos INT; n_zero_time INT; n_zero_note INT; n_stale INT;
BEGIN
  -- 2a. Lifecycle events become timestamps ----------------------------------
  --
  -- The row's own flags are the truth; events only supply the date. A past day
  -- shows an item when `created_at <= day < archived_at/deleted_at` (§2.10).

  -- Archived activities. `completed` is the legacy name for archived. The date
  -- is the latest "entered" event, else the old completed_at, else updated_at.
  WITH latest AS (
    SELECT DISTINCT ON (entity_id) entity_id, effective_at
    FROM activity_status_events
    WHERE deleted_at IS NULL
      AND status_type IN ('archived', 'completed')
      AND next_value
    ORDER BY entity_id, created_at DESC
  )
  UPDATE activities a
  SET archived_at = COALESCE(l.effective_at, a.completed_at, a.updated_at),
      updated_at = now()
  FROM activities a2
  LEFT JOIN latest l ON l.entity_id = a2.id
  WHERE a.id = a2.id
    AND a.archived_at IS NULL
    AND a.deleted_at IS NULL
    AND COALESCE(a.is_archived, FALSE);
  GET DIAGNOSTICS n_arch_act = ROW_COUNT;

  WITH latest AS (
    SELECT DISTINCT ON (entity_id) entity_id, effective_at
    FROM group_status_events
    WHERE deleted_at IS NULL AND status_type = 'archived' AND next_value
    ORDER BY entity_id, created_at DESC
  )
  UPDATE activity_groups g
  SET archived_at = COALESCE(l.effective_at, g.updated_at),
      updated_at = now()
  FROM activity_groups g2
  LEFT JOIN latest l ON l.entity_id = g2.id
  WHERE g.id = g2.id
    AND g.archived_at IS NULL
    AND g.deleted_at IS NULL
    AND COALESCE(g.is_archived, FALSE);
  GET DIAGNOSTICS n_arch_grp = ROW_COUNT;

  -- A final "deleted" event on a row that was never marked deleted: apply it,
  -- as of now so the item's recorded days stay visible. (In production this is
  -- one activity the owner confirmed they want deleted.)
  WITH last_event AS (
    SELECT DISTINCT ON (entity_id) entity_id, next_value
    FROM activity_status_events
    WHERE deleted_at IS NULL AND status_type = 'deleted'
    ORDER BY entity_id, created_at DESC
  )
  UPDATE activities a
  SET deleted_at = now(), updated_at = now()
  FROM last_event e
  WHERE e.entity_id = a.id AND e.next_value AND a.deleted_at IS NULL;
  GET DIAGNOSTICS n_del_act = ROW_COUNT;

  WITH last_event AS (
    SELECT DISTINCT ON (entity_id) entity_id, next_value
    FROM group_status_events
    WHERE deleted_at IS NULL AND status_type = 'deleted'
    ORDER BY entity_id, created_at DESC
  )
  UPDATE activity_groups g
  SET deleted_at = now(), updated_at = now()
  FROM last_event e
  WHERE e.entity_id = g.id AND e.next_value AND g.deleted_at IS NULL;
  GET DIAGNOSTICS n_del_grp = ROW_COUNT;

  -- 2b. Hidden group activities become named -------------------------------
  --
  -- An activity with no name was how the app timed "a whole group" without
  -- picking an activity. It is named after its group ("<group> · general" if
  -- that name is taken) and made a time-only activity. One with no live data
  -- (no live session, no count, note or completion time on any day) is then
  -- deleted: it holds nothing, and would only add an empty item to Today.
  WITH hidden AS (
    SELECT a.id,
           g.name AS group_name,
           EXISTS (
             SELECT 1 FROM activities o
             WHERE o.group_id = a.group_id AND o.id <> a.id
               AND lower(o.name) = lower(g.name)
           ) AS clash,
           (
             EXISTS (
               SELECT 1 FROM activity_periods p
               WHERE p.activity_id = a.id AND p.deleted_at IS NULL
             )
             OR EXISTS (
               SELECT 1 FROM daily_entries d
               WHERE d.user_id = a.user_id
                 AND (d.task_counts ? a.id::text
                      OR d.completion_notes ? a.id::text
                      OR d.completion_times ? a.id::text)
             )
           ) AS has_data
    FROM activities a
    JOIN activity_groups g ON g.id = a.group_id
    WHERE a.name IS NULL
  ),
  changed AS (
    UPDATE activities a
    SET name = CASE WHEN h.clash THEN h.group_name || ' · general'
                    ELSE h.group_name END,
        routine = COALESCE(a.routine, 'anytime'),
        tracks_time = TRUE,
        deleted_at = CASE WHEN h.has_data THEN a.deleted_at
                          ELSE COALESCE(a.deleted_at, now()) END,
        updated_at = now()
    FROM hidden h
    WHERE a.id = h.id
    RETURNING h.has_data
  )
  SELECT count(*), count(*) FILTER (WHERE NOT has_data)
  INTO n_hidden_named, n_hidden_deleted
  FROM changed;

  -- 2c. Avoid habits never track time (§2.1) ---------------------------------
  UPDATE activities
  SET tracks_time = FALSE, updated_at = now()
  WHERE routine = 'never' AND tracks_time;
  GET DIAGNOSTICS n_avoid = ROW_COUNT;

  -- 2d. Recurring memos become check-only activities ------------------------
  --
  -- Ids are derived from the memo's id, so a re-run finds them again and
  -- inserts nothing. They live in a "Routines" group the user can rename.
  INSERT INTO activity_groups (id, user_id, name, color, order_index, is_archived,
                               created_at, updated_at)
  SELECT md5('a6:routines-group:' || m.user_id::text)::uuid, m.user_id,
         'Routines', NULL, NULL, FALSE, now(), now()
  FROM recurring_memos m
  GROUP BY m.user_id
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS n_memo_groups = ROW_COUNT;

  INSERT INTO activities (id, user_id, group_id, name, routine, completion_target,
                          is_archived, order_index, tracks_time, is_pinned,
                          archived_at, created_at, updated_at, deleted_at)
  SELECT md5('a6:memo:' || m.id::text)::uuid, m.user_id,
         md5('a6:routines-group:' || m.user_id::text)::uuid,
         m.title, m.routine, 1,
         NOT COALESCE(m.is_enabled, TRUE), NULL, FALSE,
         COALESCE(m.is_pinned, FALSE),
         CASE WHEN NOT COALESCE(m.is_enabled, TRUE) THEN m.updated_at END,
         m.created_at, now(), m.deleted_at
  FROM recurring_memos m
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS n_memos = ROW_COUNT;

  -- 2e. Zero-length sessions: the day's count is the truth (§2.2) -----------
  --
  -- A zero-length session is an old way of recording "done at HH:MM". It
  -- donates its time and note to the day only when that day's count reached the
  -- target; otherwise it is ignored. The session itself is kept. When several
  -- fall on one day for one activity the latest wins, since that is the one
  -- that completed it.
  --
  -- A day can have many completing activities, and an UPDATE ... FROM that
  -- matches several source rows to one target row applies only one of them, so
  -- each day's donations are combined into a single object first.
  DROP TABLE IF EXISTS _a6_donors;
  CREATE TEMP TABLE _a6_donors AS
  SELECT DISTINCT ON (p.daily_entry_id, p.activity_id)
         p.daily_entry_id AS entry_id, p.activity_id,
         to_char(p.start_time AT TIME ZONE 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS done_at,
         p.note
  FROM activity_periods p
  JOIN daily_entries d ON d.id = p.daily_entry_id
  JOIN activities a ON a.id = p.activity_id
  WHERE p.deleted_at IS NULL
    AND p.end_time IS NOT NULL
    AND p.start_time = p.end_time
    AND COALESCE((d.task_counts ->> p.activity_id::text)::INT, 0)
        >= COALESCE(a.completion_target, 1)
  ORDER BY p.daily_entry_id, p.activity_id, p.start_time DESC;

  WITH per_day AS (
    SELECT o.entry_id,
           jsonb_object_agg(o.activity_id::text, o.done_at) AS times
    FROM _a6_donors o
    JOIN daily_entries d ON d.id = o.entry_id
    WHERE NOT (d.completion_times ? o.activity_id::text)
    GROUP BY o.entry_id
  ), changed AS (
    UPDATE daily_entries d
    SET completion_times = d.completion_times || p.times, updated_at = now()
    FROM per_day p
    WHERE d.id = p.entry_id
    RETURNING (SELECT count(*) FROM jsonb_object_keys(p.times)) AS filled
  )
  SELECT COALESCE(sum(filled), 0) INTO n_zero_time FROM changed;

  WITH per_day AS (
    SELECT o.entry_id,
           jsonb_object_agg(o.activity_id::text, o.note) AS notes
    FROM _a6_donors o
    JOIN daily_entries d ON d.id = o.entry_id
    WHERE o.note IS NOT NULL
      AND NOT (COALESCE(d.completion_notes, '{}'::jsonb) ? o.activity_id::text)
    GROUP BY o.entry_id
  ), changed AS (
    UPDATE daily_entries d
    SET completion_notes = COALESCE(d.completion_notes, '{}'::jsonb) || p.notes,
        updated_at = now()
    FROM per_day p
    WHERE d.id = p.entry_id
    RETURNING (SELECT count(*) FROM jsonb_object_keys(p.notes)) AS filled
  )
  SELECT COALESCE(sum(filled), 0) INTO n_zero_note FROM changed;
  DROP TABLE _a6_donors;

  -- 2f. Forgotten running sessions ------------------------------------------
  --
  -- A session left running for more than a day is almost certainly forgotten,
  -- and since sessions now appear on every day they overlap it would add 24
  -- hours to each of them. Close it one hour after it started, so it is still
  -- there as a record. A session running for less than a day is left alone.
  UPDATE activity_periods
  SET end_time = start_time + INTERVAL '1 hour', updated_at = now()
  WHERE end_time IS NULL
    AND deleted_at IS NULL
    AND start_time < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS n_stale = ROW_COUNT;

  RETURN jsonb_build_object(
    'archived_activities', n_arch_act,
    'archived_groups', n_arch_grp,
    'deleted_activities_from_events', n_del_act,
    'deleted_groups_from_events', n_del_grp,
    'hidden_activities_named', n_hidden_named,
    'hidden_activities_deleted', n_hidden_deleted,
    'avoid_habits_set_untimed', n_avoid,
    'routines_groups_created', n_memo_groups,
    'memos_converted', n_memos,
    'completion_times_filled', n_zero_time,
    'completion_notes_filled', n_zero_note,
    'stale_sessions_closed', n_stale
  );
END;
$$;

ALTER FUNCTION cutover_a6_convert() OWNER TO postgres;
REVOKE ALL ON FUNCTION cutover_a6_convert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cutover_a6_convert() TO service_role;

-- ─── 3. Retire the old shapes ────────────────────────────────────────────────

-- The old event and memo tables stay (so their history is not destroyed) but
-- become read-only: only SELECT remains.
DO $$
DECLARE t TEXT; p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['activity_status_events', 'group_status_events', 'recurring_memos']
  LOOP
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd <> 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- submit_sync_operations_ungated -------------------------------------------
-- Keep the existing body under a new name and put the cutover rules in front:
--   * the retired entity types are refused;
--   * a session no longer carries a daily-entry link (§2.10), so the link is
--     dropped before the body runs. That also stops it creating empty
--     daily-entry rows for sessions;
--   * the fields the old body does not know (tracks_time, is_pinned,
--     archived_at) are stored after it accepts an activity or group.
ALTER FUNCTION submit_sync_operations_ungated(JSONB)
  RENAME TO submit_sync_operations_before_cutover;
REVOKE ALL ON FUNCTION submit_sync_operations_before_cutover(JSONB)
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
  forwarded JSONB := '[]'::jsonb;
  results JSONB := '[]'::jsonb;
  inner_results JSONB;
  accepted JSONB;
  entity_uuid UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(COALESCE(ops, '[]'::jsonb)) LOOP
    IF op->>'entity_type' IN ('activity_status_event', 'group_status_event', 'recurring_memo') THEN
      results := results || jsonb_build_array(jsonb_build_object(
        'operation_id', COALESCE(NULLIF(op->>'operation_id', ''), '00000000-0000-0000-0000-000000000000'),
        'status', 'error',
        'server_sequence', 0,
        'detail', 'entity_type_retired'));
    ELSIF op->>'entity_type' = 'activity_period'
          AND jsonb_typeof(op->'payload'->'row') = 'object' THEN
      forwarded := forwarded || jsonb_build_array(
        jsonb_set(op, '{payload,row}', (op->'payload'->'row') - 'daily_entry_id'));
    ELSE
      forwarded := forwarded || jsonb_build_array(op);
    END IF;
  END LOOP;

  IF jsonb_array_length(forwarded) > 0 THEN
    inner_results := submit_sync_operations_before_cutover(forwarded);
    results := results || inner_results;

    -- Store the new fields for the activity and group ops that were accepted.
    FOR op IN SELECT * FROM jsonb_array_elements(forwarded) LOOP
      IF op->>'entity_type' NOT IN ('activity', 'activity_group')
         OR op->>'operation_type' <> 'projection.upsert' THEN
        CONTINUE;
      END IF;
      SELECT r INTO accepted
      FROM jsonb_array_elements(inner_results) r
      WHERE r->>'operation_id' = op->>'operation_id' AND r->>'status' = 'accepted'
      LIMIT 1;
      IF accepted IS NULL THEN CONTINUE; END IF;

      row := COALESCE(op->'payload'->'row', '{}'::jsonb);
      entity_uuid := NULLIF(op->>'entity_id', '')::uuid;
      IF entity_uuid IS NULL THEN CONTINUE; END IF;

      IF op->>'entity_type' = 'activity' THEN
        UPDATE activities SET
          tracks_time = COALESCE((row->>'tracks_time')::boolean, tracks_time),
          is_pinned = COALESCE((row->>'is_pinned')::boolean, is_pinned),
          -- A present-but-null archived_at means "restored", so test the key.
          archived_at = CASE WHEN row ? 'archived_at'
                             THEN NULLIF(row->>'archived_at', '')::timestamptz
                             ELSE archived_at END
        WHERE id = entity_uuid AND user_id = uid;
      ELSE
        UPDATE activity_groups SET
          archived_at = CASE WHEN row ? 'archived_at'
                             THEN NULLIF(row->>'archived_at', '')::timestamptz
                             ELSE archived_at END
        WHERE id = entity_uuid AND user_id = uid;
      END IF;
    END LOOP;
  END IF;

  RETURN results;
END;
$$;

ALTER FUNCTION submit_sync_operations_ungated(JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION submit_sync_operations_ungated(JSONB)
  FROM PUBLIC, anon, authenticated;

-- ─── 4. Convert the data and raise the gates ─────────────────────────────────

DO $$
DECLARE summary JSONB;
BEGIN
  summary := cutover_a6_convert();
  RAISE NOTICE 'A6 conversion: %', summary;
END $$;

-- Turn away builds older than this one, and make every device push its
-- pending operations and re-bootstrap from the converted snapshot.
UPDATE app_config
SET min_client_protocol = GREATEST(min_client_protocol, 2),
    data_epoch = data_epoch + 1;

NOTIFY pgrst, 'reload schema';
