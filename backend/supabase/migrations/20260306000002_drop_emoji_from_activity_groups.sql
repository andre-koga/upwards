-- Remove emoji column from activity_groups
-- Groups are now identified by color only
ALTER TABLE activity_groups DROP COLUMN IF EXISTS emoji;