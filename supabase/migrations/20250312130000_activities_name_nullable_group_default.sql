-- Group-default activity: name = null (timing the group without a specific activity).
-- Migrate from routine = '__group_default_hidden__' to name = null.

UPDATE activities
SET name = NULL
WHERE routine = '__group_default_hidden__';

UPDATE activities
SET routine = NULL
WHERE name IS NULL;

ALTER TABLE activities ALTER COLUMN name DROP NOT NULL;
