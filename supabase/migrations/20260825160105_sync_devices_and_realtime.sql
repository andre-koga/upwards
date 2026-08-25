-- Device registry for multi-device observability + Realtime wake on sync_operations.

CREATE TABLE IF NOT EXISTS sync_devices (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sync_devices_user_last_seen
  ON sync_devices(user_id, last_seen_at DESC);

DROP TRIGGER IF EXISTS trg_sync_devices_updated_at ON sync_devices;
CREATE TRIGGER trg_sync_devices_updated_at
  BEFORE INSERT OR UPDATE ON sync_devices
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

ALTER TABLE sync_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sync devices" ON sync_devices;
DROP POLICY IF EXISTS "Users can insert their own sync devices" ON sync_devices;
DROP POLICY IF EXISTS "Users can update their own sync devices" ON sync_devices;
DROP POLICY IF EXISTS "Users can delete their own sync devices" ON sync_devices;

CREATE POLICY "Users can view their own sync devices"
  ON sync_devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sync devices"
  ON sync_devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sync devices"
  ON sync_devices FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sync devices"
  ON sync_devices FOR DELETE USING (auth.uid() = user_id);

-- Wake other devices when new sync operations arrive (INSERT-only stream).
ALTER PUBLICATION supabase_realtime ADD TABLE sync_operations;
