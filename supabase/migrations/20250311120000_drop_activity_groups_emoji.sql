-- Drop emoji column from activity_groups
ALTER TABLE activity_groups DROP COLUMN IF EXISTS emoji;
