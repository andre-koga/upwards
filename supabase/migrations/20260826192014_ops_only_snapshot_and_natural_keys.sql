-- Ops-only incremental sync: snapshot bootstrap, natural journal keys,
-- ignore untimed period upserts, stop writing definition versions,
-- completion notes on daily_entries.

ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS completion_notes JSONB DEFAULT '{}'::jsonb;

-- Fix submit_sync_operations for TEXT date columns and TEXT[] photo_paths.
-- daily_entries.date and journal_entries.entry_date are TEXT in schema; comparing
-- or inserting DATE values caused "operator does not exist: text = date" and
-- photo_paths jsonb coercion errors.

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
  canonical_id UUID;
  operation_type TEXT;
  base_revision TEXT;
  device_id TEXT;
  payload JSONB;
  latest_version_id UUID;
  status TEXT;
  daily_date TEXT;
  activity_uuid UUID;
  delta INT;
  entry_id UUID;
  counts JSONB;
  paused JSONB;
  prev_count INT;
  next_count INT;
  tip_fields JSONB;
  base_fields JSONB;
  incoming_fields JSONB;
  merged_fields JSONB;
  field_key TEXT;
  tip_val TEXT;
  base_val TEXT;
  inc_val TEXT;
  both_changed BOOLEAN;
  projection_row JSONB;
  remote_updated TEXT;
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
    tip_fields := NULL;
    base_fields := NULL;
    incoming_fields := COALESCE(payload->'fields', '{}'::jsonb);
    merged_fields := incoming_fields;
    both_changed := false;

    -- Definition conflict / field-level merge when base is stale.
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

        IF latest_version_id IS NOT NULL THEN
          SELECT jsonb_strip_nulls(jsonb_build_object(
            'name', adv.name,
            'routine', adv.routine,
            'completion_target', adv.completion_target,
            'group_id', adv.group_id,
            'order_index', adv.order_index
          )) INTO tip_fields
          FROM activity_definition_versions adv
          WHERE adv.id = latest_version_id;

          SELECT jsonb_strip_nulls(jsonb_build_object(
            'name', adv.name,
            'routine', adv.routine,
            'completion_target', adv.completion_target,
            'group_id', adv.group_id,
            'order_index', adv.order_index
          )) INTO base_fields
          FROM activity_definition_versions adv
          WHERE adv.id = base_revision::UUID AND adv.user_id = uid;
        END IF;
      ELSE
        SELECT gdv.id INTO latest_version_id
        FROM group_definition_versions gdv
        WHERE gdv.user_id = uid
          AND gdv.group_id = entity_id
          AND gdv.deleted_at IS NULL
        ORDER BY gdv.effective_from DESC, gdv.recorded_at DESC
        LIMIT 1;

        IF latest_version_id IS NOT NULL THEN
          SELECT jsonb_strip_nulls(jsonb_build_object(
            'name', gdv.name,
            'color', gdv.color,
            'order_index', gdv.order_index
          )) INTO tip_fields
          FROM group_definition_versions gdv
          WHERE gdv.id = latest_version_id;

          SELECT jsonb_strip_nulls(jsonb_build_object(
            'name', gdv.name,
            'color', gdv.color,
            'order_index', gdv.order_index
          )) INTO base_fields
          FROM group_definition_versions gdv
          WHERE gdv.id = base_revision::UUID AND gdv.user_id = uid;
        END IF;
      END IF;

      IF latest_version_id IS NOT NULL
         AND latest_version_id::TEXT <> base_revision THEN
        IF tip_fields IS NULL OR base_fields IS NULL THEN
          status := 'conflict';
        ELSE
          merged_fields := '{}'::jsonb;
          FOR field_key IN
            SELECT DISTINCT key FROM (
              SELECT jsonb_object_keys(incoming_fields) AS key
              UNION
              SELECT jsonb_object_keys(tip_fields) AS key
              UNION
              SELECT jsonb_object_keys(base_fields) AS key
            ) keys
          LOOP
            tip_val := tip_fields->>field_key;
            base_val := base_fields->>field_key;
            inc_val := incoming_fields->>field_key;

            IF tip_val IS NOT DISTINCT FROM inc_val THEN
              merged_fields := jsonb_set(
                merged_fields,
                ARRAY[field_key],
                COALESCE(tip_fields->field_key, 'null'::jsonb),
                true
              );
            ELSIF tip_val IS NOT DISTINCT FROM base_val THEN
              -- Only the incoming side changed this field.
              merged_fields := jsonb_set(
                merged_fields,
                ARRAY[field_key],
                COALESCE(incoming_fields->field_key, 'null'::jsonb),
                true
              );
            ELSIF inc_val IS NOT DISTINCT FROM base_val THEN
              -- Only the tip side changed this field.
              merged_fields := jsonb_set(
                merged_fields,
                ARRAY[field_key],
                COALESCE(tip_fields->field_key, 'null'::jsonb),
                true
              );
            ELSE
              both_changed := true;
              EXIT;
            END IF;
          END LOOP;

          IF both_changed THEN
            status := 'conflict';
          ELSE
            status := 'accepted';
            payload := jsonb_set(payload, '{fields}', merged_fields, true);
            -- Parent the merged version on the current tip.
            payload := jsonb_set(
              payload,
              '{parent_version_id}',
              to_jsonb(latest_version_id::TEXT),
              true
            );
          END IF;
        END IF;
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

    IF status = 'accepted' AND entity_type = 'activity_definition'
       AND operation_type IN ('definition.create', 'definition.update') THEN
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

    IF status = 'accepted' AND entity_type = 'group_definition'
       AND operation_type IN ('definition.create', 'definition.update') THEN
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

    IF status = 'accepted' AND entity_type = 'daily_entry' THEN
      daily_date := NULLIF(payload->>'date', '');
      activity_uuid := NULLIF(payload->>'activity_id', '')::UUID;

      IF daily_date IS NOT NULL THEN
        SELECT de.id, COALESCE(de.task_counts, '{}'::jsonb), COALESCE(de.paused_task_ids, '[]'::jsonb)
        INTO entry_id, counts, paused
        FROM daily_entries de
        WHERE de.user_id = uid AND de.date = daily_date AND de.deleted_at IS NULL
        LIMIT 1;

        IF entry_id IS NULL THEN
          entry_id := COALESCE(NULLIF(payload->>'daily_entry_id', '')::UUID, gen_random_uuid());
          counts := '{}'::jsonb;
          paused := '[]'::jsonb;
          INSERT INTO daily_entries (
            id, user_id, date, task_counts, paused_task_ids, is_break_day,
            current_activity_id, completion_notes, created_at, updated_at
          ) VALUES (
            entry_id, uid, daily_date, counts, paused, false,
            NULL, '{}'::jsonb, now(), now()
          )
          ON CONFLICT (user_id, date) DO NOTHING;
          SELECT de.id, COALESCE(de.task_counts, '{}'::jsonb), COALESCE(de.paused_task_ids, '[]'::jsonb)
          INTO entry_id, counts, paused
          FROM daily_entries de
          WHERE de.user_id = uid AND de.date = daily_date AND de.deleted_at IS NULL
          LIMIT 1;
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
        ELSIF operation_type = 'completion.note' AND activity_uuid IS NOT NULL THEN
          UPDATE daily_entries
          SET completion_notes = CASE
            WHEN NULLIF(payload->>'note', '') IS NULL THEN
              COALESCE(completion_notes, '{}'::jsonb) - activity_uuid::TEXT
            ELSE
              jsonb_set(
                COALESCE(completion_notes, '{}'::jsonb),
                ARRAY[activity_uuid::TEXT],
                to_jsonb(left(payload->>'note', 200)),
                true
              )
          END,
          updated_at = now()
          WHERE id = entry_id;
        END IF;
      END IF;
    END IF;

    -- Generic projection row upserts (journal, timers, memos, streaks, status, activity shell).
    IF status = 'accepted'
       AND operation_type = 'projection.upsert'
       AND entity_id IS NOT NULL THEN
      projection_row := COALESCE(payload->'row', '{}'::jsonb);

      IF entity_type NOT IN (
        'activity_status_event', 'group_status_event'
      ) AND base_revision IS NOT NULL THEN
        remote_updated := NULL;
        IF entity_type = 'journal_entry' THEN
          canonical_id := NULL;
          SELECT je.id, je.updated_at::TEXT INTO canonical_id, remote_updated
          FROM journal_entries je
          WHERE je.user_id = uid
            AND (
              je.id = entity_id
              OR je.entry_date = COALESCE(projection_row->>'entry_date', '')
            )
          ORDER BY CASE WHEN je.id = entity_id THEN 0 ELSE 1 END
          LIMIT 1;
          IF canonical_id IS NOT NULL THEN
            entity_id := canonical_id;
          END IF;
        ELSIF entity_type = 'activity_period' THEN
          SELECT ap.updated_at::TEXT INTO remote_updated
          FROM activity_periods ap
          WHERE ap.id = entity_id AND ap.user_id = uid;
        ELSIF entity_type = 'one_time_task' THEN
          SELECT ott.updated_at::TEXT INTO remote_updated
          FROM one_time_tasks ott
          WHERE ott.id = entity_id AND ott.user_id = uid;
        ELSIF entity_type = 'recurring_memo' THEN
          SELECT rm.updated_at::TEXT INTO remote_updated
          FROM recurring_memos rm
          WHERE rm.id = entity_id AND rm.user_id = uid;
        ELSIF entity_type = 'activity_streak' THEN
          SELECT ast.updated_at::TEXT INTO remote_updated
          FROM activity_streaks ast
          WHERE ast.id = entity_id AND ast.user_id = uid;
        ELSIF entity_type = 'activity' THEN
          SELECT a.updated_at::TEXT INTO remote_updated
          FROM activities a
          WHERE a.id = entity_id AND a.user_id = uid;
        ELSIF entity_type = 'activity_group' THEN
          SELECT ag.updated_at::TEXT INTO remote_updated
          FROM activity_groups ag
          WHERE ag.id = entity_id AND ag.user_id = uid;
        END IF;

        IF remote_updated IS NOT NULL AND remote_updated > base_revision THEN
          status := 'conflict';
          UPDATE sync_operations
          SET status = 'conflict'
          WHERE user_id = uid AND operation_id = op_id;
        END IF;
      END IF;
    END IF;

    IF status = 'accepted'
       AND operation_type = 'projection.upsert'
       AND entity_id IS NOT NULL THEN
      projection_row := COALESCE(payload->'row', '{}'::jsonb);

      IF entity_type = 'journal_entry' THEN
        SELECT je.id INTO canonical_id
        FROM journal_entries je
        WHERE je.user_id = uid
          AND je.entry_date = COALESCE(projection_row->>'entry_date', '')
        LIMIT 1;
        IF canonical_id IS NOT NULL THEN
          entity_id := canonical_id;
        END IF;
        INSERT INTO journal_entries (
          id, user_id, entry_date, title, text_content, day_emoji, is_bookmarked,
          video_path, video_thumbnail, photo_paths, is_journal_complete,
          journal_entry_number, journal_completion_streak, journal_completed_at,
          location, created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          projection_row->>'entry_date',
          projection_row->>'title',
          projection_row->>'text_content',
          projection_row->>'day_emoji',
          NULLIF(projection_row->>'is_bookmarked', '')::BOOLEAN,
          projection_row->>'video_path',
          projection_row->>'video_thumbnail',
          CASE
            WHEN projection_row->'photo_paths' IS NULL THEN NULL
            WHEN jsonb_typeof(projection_row->'photo_paths') = 'array' THEN
              ARRAY(
                SELECT jsonb_array_elements_text(projection_row->'photo_paths')
              )
            ELSE NULL
          END,
          NULLIF(projection_row->>'is_journal_complete', '')::BOOLEAN,
          NULLIF(projection_row->>'journal_entry_number', '')::INTEGER,
          NULLIF(projection_row->>'journal_completion_streak', '')::INTEGER,
          NULLIF(projection_row->>'journal_completed_at', '')::TIMESTAMPTZ,
          projection_row->'location',
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (user_id, entry_date) DO UPDATE SET
          title = EXCLUDED.title,
          text_content = EXCLUDED.text_content,
          day_emoji = EXCLUDED.day_emoji,
          is_bookmarked = EXCLUDED.is_bookmarked,
          video_path = EXCLUDED.video_path,
          video_thumbnail = EXCLUDED.video_thumbnail,
          photo_paths = EXCLUDED.photo_paths,
          is_journal_complete = EXCLUDED.is_journal_complete,
          journal_entry_number = EXCLUDED.journal_entry_number,
          journal_completion_streak = EXCLUDED.journal_completion_streak,
          journal_completed_at = EXCLUDED.journal_completed_at,
          location = EXCLUDED.location,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at;

      ELSIF entity_type = 'activity_period' THEN
        IF NULLIF(projection_row->>'end_time', '') IS NOT NULL
           AND NULLIF(projection_row->>'start_time', '') IS NOT DISTINCT FROM NULLIF(projection_row->>'end_time', '') THEN
          -- Untimed completions are derived from counts; do not store them as facts.
          NULL;
        ELSE
        INSERT INTO activity_periods (
          id, user_id, daily_entry_id, activity_id, start_time, end_time, note,
          created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          NULLIF(projection_row->>'daily_entry_id', '')::UUID,
          NULLIF(projection_row->>'activity_id', '')::UUID,
          NULLIF(projection_row->>'start_time', '')::TIMESTAMPTZ,
          NULLIF(projection_row->>'end_time', '')::TIMESTAMPTZ,
          NULLIF(left(COALESCE(projection_row->>'note', ''), 200), ''),
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO UPDATE SET
          daily_entry_id = COALESCE(EXCLUDED.daily_entry_id, activity_periods.daily_entry_id),
          activity_id = COALESCE(EXCLUDED.activity_id, activity_periods.activity_id),
          start_time = COALESCE(EXCLUDED.start_time, activity_periods.start_time),
          end_time = EXCLUDED.end_time,
          note = EXCLUDED.note,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at;
        END IF;

      ELSIF entity_type = 'one_time_task' THEN
        INSERT INTO one_time_tasks (
          id, user_id, date, title, is_completed, order_index, is_pinned,
          due_date, group_id, is_archived, recurring_memo_id,
          created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          NULLIF(projection_row->>'date', '')::DATE,
          COALESCE(projection_row->>'title', ''),
          NULLIF(projection_row->>'is_completed', '')::BOOLEAN,
          NULLIF(projection_row->>'order_index', '')::INTEGER,
          NULLIF(projection_row->>'is_pinned', '')::BOOLEAN,
          NULLIF(projection_row->>'due_date', '')::DATE,
          NULLIF(projection_row->>'group_id', '')::UUID,
          NULLIF(projection_row->>'is_archived', '')::BOOLEAN,
          NULLIF(projection_row->>'recurring_memo_id', '')::UUID,
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          title = EXCLUDED.title,
          is_completed = EXCLUDED.is_completed,
          order_index = EXCLUDED.order_index,
          is_pinned = EXCLUDED.is_pinned,
          due_date = EXCLUDED.due_date,
          group_id = EXCLUDED.group_id,
          is_archived = EXCLUDED.is_archived,
          recurring_memo_id = EXCLUDED.recurring_memo_id,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at;

      ELSIF entity_type = 'recurring_memo' THEN
        INSERT INTO recurring_memos (
          id, user_id, title, routine, is_pinned, is_enabled,
          created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          COALESCE(projection_row->>'title', ''),
          COALESCE(projection_row->>'routine', 'daily'),
          NULLIF(projection_row->>'is_pinned', '')::BOOLEAN,
          NULLIF(projection_row->>'is_enabled', '')::BOOLEAN,
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          routine = EXCLUDED.routine,
          is_pinned = EXCLUDED.is_pinned,
          is_enabled = EXCLUDED.is_enabled,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at;

      ELSIF entity_type = 'activity_streak' THEN
        NULL;

      ELSIF entity_type = 'activity_status_event' THEN
        INSERT INTO activity_status_events (
          id, user_id, entity_id, status_type, next_value, effective_at,
          created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          NULLIF(projection_row->>'entity_id', '')::UUID,
          COALESCE(projection_row->>'status_type', 'completed'),
          COALESCE(NULLIF(projection_row->>'next_value', '')::BOOLEAN, true),
          COALESCE(NULLIF(projection_row->>'effective_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO NOTHING;

      ELSIF entity_type = 'group_status_event' THEN
        INSERT INTO group_status_events (
          id, user_id, entity_id, status_type, next_value, effective_at,
          created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          NULLIF(projection_row->>'entity_id', '')::UUID,
          COALESCE(projection_row->>'status_type', 'archived'),
          COALESCE(NULLIF(projection_row->>'next_value', '')::BOOLEAN, true),
          COALESCE(NULLIF(projection_row->>'effective_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO NOTHING;

      ELSIF entity_type = 'activity' THEN
        INSERT INTO activities (
          id, user_id, group_id, name, routine, completion_target,
          completed_at, is_archived, order_index, created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          NULLIF(projection_row->>'group_id', '')::UUID,
          projection_row->>'name',
          projection_row->>'routine',
          NULLIF(projection_row->>'completion_target', '')::INTEGER,
          NULLIF(projection_row->>'completed_at', '')::TIMESTAMPTZ,
          NULLIF(projection_row->>'is_archived', '')::BOOLEAN,
          NULLIF(projection_row->>'order_index', '')::INTEGER,
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO UPDATE SET
          group_id = COALESCE(EXCLUDED.group_id, activities.group_id),
          name = COALESCE(EXCLUDED.name, activities.name),
          routine = COALESCE(EXCLUDED.routine, activities.routine),
          completion_target = COALESCE(EXCLUDED.completion_target, activities.completion_target),
          completed_at = EXCLUDED.completed_at,
          is_archived = COALESCE(EXCLUDED.is_archived, activities.is_archived),
          order_index = COALESCE(EXCLUDED.order_index, activities.order_index),
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at;

      ELSIF entity_type = 'activity_group' THEN
        INSERT INTO activity_groups (
          id, user_id, name, emoji, color, order_index, is_archived,
          created_at, updated_at, deleted_at
        ) VALUES (
          entity_id, uid,
          COALESCE(projection_row->>'name', 'Group'),
          NULL,
          projection_row->>'color',
          NULLIF(projection_row->>'order_index', '')::INTEGER,
          NULLIF(projection_row->>'is_archived', '')::BOOLEAN,
          COALESCE(NULLIF(projection_row->>'created_at', '')::TIMESTAMPTZ, now()),
          COALESCE(NULLIF(projection_row->>'updated_at', '')::TIMESTAMPTZ, now()),
          NULLIF(projection_row->>'deleted_at', '')::TIMESTAMPTZ
        )
        ON CONFLICT (id) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, activity_groups.name),
          color = EXCLUDED.color,
          order_index = COALESCE(EXCLUDED.order_index, activity_groups.order_index),
          is_archived = EXCLUDED.is_archived,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at;
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

CREATE OR REPLACE FUNCTION pull_sync_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'recurring_memos', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM recurring_memos t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'activity_status_events', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM activity_status_events t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'group_status_events', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM group_status_events t WHERE t.user_id = uid),
      '[]'::jsonb
    )
  );
END;
$$;

ALTER FUNCTION submit_sync_operations(JSONB) OWNER TO postgres;
ALTER FUNCTION pull_sync_snapshot() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pull_sync_snapshot() TO authenticated;
