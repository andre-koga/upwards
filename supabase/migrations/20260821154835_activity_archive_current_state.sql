-- Restore per-habit archive (same pattern as groups).
-- Dual-write with completed_at so older clients that only know that column
-- still hide archived habits.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

UPDATE activities
SET is_archived = TRUE
WHERE completed_at IS NOT NULL
  AND COALESCE(is_archived, FALSE) IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_activities_is_archived
  ON activities(user_id, is_archived);

CREATE OR REPLACE FUNCTION activities_keep_archive_flags_in_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_archived IS TRUE THEN
      NEW.completed_at := COALESCE(NEW.completed_at, NEW.updated_at, now());
    ELSIF NEW.completed_at IS NOT NULL THEN
      NEW.is_archived := TRUE;
    ELSE
      NEW.is_archived := COALESCE(NEW.is_archived, FALSE);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
    IF NEW.is_archived THEN
      NEW.completed_at := COALESCE(NEW.completed_at, NEW.updated_at, now());
    ELSE
      NEW.completed_at := NULL;
    END IF;
  ELSIF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    NEW.is_archived := NEW.completed_at IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activities_keep_archive_flags_in_sync ON activities;
CREATE TRIGGER trg_activities_keep_archive_flags_in_sync
  BEFORE INSERT OR UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION activities_keep_archive_flags_in_sync();
