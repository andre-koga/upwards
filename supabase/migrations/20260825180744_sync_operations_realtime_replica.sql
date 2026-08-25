-- Realtime postgres_changes filters need replica identity FULL when the
-- filter/payload columns are not the primary key. INSERT payloads then include
-- user_id and device_id so other devices can ignore their own ops.

ALTER TABLE sync_operations REPLICA IDENTITY FULL;

-- Re-add in case an earlier publication add was skipped on a clone.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_operations;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;
