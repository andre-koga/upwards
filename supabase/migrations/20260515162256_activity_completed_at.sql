-- Add completed_at to activities to model a "finished" goal state,
-- distinct from is_archived which hides a habit indefinitely.
-- completed_at: set when the user taps "Mark as done"; hides the habit
-- from For Today and closes any active promise linked to it.

ALTER TABLE activities ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_activities_completed_at ON activities(completed_at);
