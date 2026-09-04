-- Untimed completions are derived from count facts, not stored as activity
-- periods. Keep their display instant with the daily projection so it survives
-- a snapshot and is available to every device.
ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS completion_times JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION apply_untimed_completion_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_date TEXT;
  activity_uuid UUID;
  entry_uuid UUID;
  times JSONB;
  completion_time TEXT;
BEGIN
  IF NEW.status <> 'accepted'
     OR NEW.entity_type <> 'daily_entry'
     OR NEW.operation_type <> 'count.delta'
     OR NOT (NEW.payload ? 'completion_at') THEN
    RETURN NEW;
  END IF;

  daily_date := NULLIF(NEW.payload->>'date', '');
  activity_uuid := NULLIF(NEW.payload->>'activity_id', '')::UUID;
  IF daily_date IS NULL OR activity_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO daily_entries (
    id, user_id, date, task_counts, paused_task_ids, is_break_day,
    current_activity_id, completion_notes, completion_times, created_at, updated_at
  ) VALUES (
    COALESCE(NULLIF(NEW.payload->>'daily_entry_id', '')::UUID, gen_random_uuid()),
    NEW.user_id, daily_date, '{}'::jsonb, '[]'::jsonb, false,
    NULL, '{}'::jsonb, '{}'::jsonb, now(), now()
  )
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT id, COALESCE(completion_times, '{}'::jsonb)
  INTO entry_uuid, times
  FROM daily_entries
  WHERE user_id = NEW.user_id AND date = daily_date AND deleted_at IS NULL
  LIMIT 1;

  IF entry_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  completion_time := NULLIF(NEW.payload->>'completion_at', '');
  IF completion_time IS NULL THEN
    times := times - activity_uuid::TEXT;
  ELSE
    times := jsonb_set(times, ARRAY[activity_uuid::TEXT], to_jsonb(completion_time), true);
  END IF;

  UPDATE daily_entries
  SET completion_times = times, updated_at = now()
  WHERE id = entry_uuid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_operations_untimed_completion_time ON sync_operations;
CREATE TRIGGER sync_operations_untimed_completion_time
AFTER INSERT ON sync_operations
FOR EACH ROW EXECUTE FUNCTION apply_untimed_completion_time();
