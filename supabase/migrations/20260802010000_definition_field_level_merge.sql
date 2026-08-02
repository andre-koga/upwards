-- Field-level automatic merge for definition updates when bases diverge.
-- Different fields → merge; same field edited on both sides → conflict.
-- Also documents that clients must strip op-owned projection fields from LWW
-- once these RPCs are live (see app/src/lib/sync/op-owned-fields.ts).

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
  tip_fields JSONB;
  base_fields JSONB;
  incoming_fields JSONB;
  merged_fields JSONB;
  field_key TEXT;
  tip_val TEXT;
  base_val TEXT;
  inc_val TEXT;
  both_changed BOOLEAN;
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
