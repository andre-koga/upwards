-- Goal display name and short objective set by the creator at creation time.
ALTER TABLE promises
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS objective TEXT;

UPDATE promises
SET title = creator_activity_name
WHERE title IS NULL
  AND creator_activity_name IS NOT NULL
  AND creator_activity_name <> '';

UPDATE promises
SET title = 'Goal'
WHERE title IS NULL;

UPDATE promises
SET objective = ''
WHERE objective IS NULL;

ALTER TABLE promises
    ALTER COLUMN title SET NOT NULL,
    ALTER COLUMN objective SET NOT NULL;
