-- Add server_updated_at to all sync tables.
-- This column is set exclusively by Postgres (never by the client), making it
-- the single authoritative clock for delta-pull queries. Using server time on
-- both the row and the pull cutoff eliminates client-clock-skew issues entirely,
-- removing the need for full-pull-table logic and pull buffer windows.

CREATE OR REPLACE FUNCTION set_server_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.server_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- activity_groups
ALTER TABLE activity_groups
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE activity_groups SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_groups_server_updated_at
  ON activity_groups(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_activity_groups_server_updated_at ON activity_groups;
CREATE TRIGGER trg_activity_groups_server_updated_at
  BEFORE INSERT OR UPDATE ON activity_groups
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- activities
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE activities SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_server_updated_at
  ON activities(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_activities_server_updated_at ON activities;
CREATE TRIGGER trg_activities_server_updated_at
  BEFORE INSERT OR UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- daily_entries
ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE daily_entries SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_entries_server_updated_at
  ON daily_entries(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_daily_entries_server_updated_at ON daily_entries;
CREATE TRIGGER trg_daily_entries_server_updated_at
  BEFORE INSERT OR UPDATE ON daily_entries
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- activity_periods
ALTER TABLE activity_periods
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE activity_periods SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_periods_server_updated_at
  ON activity_periods(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_activity_periods_server_updated_at ON activity_periods;
CREATE TRIGGER trg_activity_periods_server_updated_at
  BEFORE INSERT OR UPDATE ON activity_periods
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- journal_entries
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE journal_entries SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_server_updated_at
  ON journal_entries(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_journal_entries_server_updated_at ON journal_entries;
CREATE TRIGGER trg_journal_entries_server_updated_at
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- one_time_tasks
ALTER TABLE one_time_tasks
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE one_time_tasks SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_one_time_tasks_server_updated_at
  ON one_time_tasks(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_one_time_tasks_server_updated_at ON one_time_tasks;
CREATE TRIGGER trg_one_time_tasks_server_updated_at
  BEFORE INSERT OR UPDATE ON one_time_tasks
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- activity_streaks
ALTER TABLE activity_streaks
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE activity_streaks SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_streaks_server_updated_at
  ON activity_streaks(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_activity_streaks_server_updated_at ON activity_streaks;
CREATE TRIGGER trg_activity_streaks_server_updated_at
  BEFORE INSERT OR UPDATE ON activity_streaks
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- activity_status_events
ALTER TABLE activity_status_events
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE activity_status_events SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_status_events_server_updated_at
  ON activity_status_events(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_activity_status_events_server_updated_at ON activity_status_events;
CREATE TRIGGER trg_activity_status_events_server_updated_at
  BEFORE INSERT OR UPDATE ON activity_status_events
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- group_status_events
ALTER TABLE group_status_events
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE group_status_events SET server_updated_at = updated_at WHERE server_updated_at = '-infinity' OR server_updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_status_events_server_updated_at
  ON group_status_events(user_id, server_updated_at);
DROP TRIGGER IF EXISTS trg_group_status_events_server_updated_at ON group_status_events;
CREATE TRIGGER trg_group_status_events_server_updated_at
  BEFORE INSERT OR UPDATE ON group_status_events
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
