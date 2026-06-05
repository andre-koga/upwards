-- Add is_archived column to one_time_tasks for memo archiving
ALTER TABLE one_time_tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of archived memos
CREATE INDEX IF NOT EXISTS idx_one_time_tasks_is_archived ON one_time_tasks(user_id, is_archived);
