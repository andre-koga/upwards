-- Migrate hidden group activities from pattern to routine, then drop pattern
UPDATE activities
SET routine = '__group_default_hidden__'
WHERE pattern = '__group_default_hidden__';

ALTER TABLE activities DROP COLUMN IF EXISTS pattern;

-- Drop color from activities; color is inherited from the group
ALTER TABLE activities DROP COLUMN IF EXISTS color;
