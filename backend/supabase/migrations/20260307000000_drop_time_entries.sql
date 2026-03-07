-- Drop legacy time_entries table
-- Replaced by activity_periods table which tracks activities per daily_entry
DROP POLICY IF EXISTS "User can delete their own time entries." ON time_entries;
DROP POLICY IF EXISTS "User can update their own time entries." ON time_entries;
DROP POLICY IF EXISTS "User can create a time entry." ON time_entries;
DROP POLICY IF EXISTS "User can see their own time entries only." ON time_entries;
DROP TABLE IF EXISTS time_entries;