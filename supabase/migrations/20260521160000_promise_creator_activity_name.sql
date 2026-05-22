-- Store the creator's habit display name on the goal for invites and notifications.
ALTER TABLE promises
    ADD COLUMN IF NOT EXISTS creator_activity_name TEXT;

-- Backfill from the most recent progress event when available.
UPDATE promises p
SET creator_activity_name = sub.activity_name
FROM (
    SELECT DISTINCT ON (promise_id)
        promise_id,
        payload->>'activityName' AS activity_name
    FROM promise_progress_events
    WHERE payload->>'activityName' IS NOT NULL
      AND btrim(payload->>'activityName') <> ''
    ORDER BY promise_id, created_at DESC
) sub
WHERE p.id = sub.promise_id
  AND p.creator_activity_name IS NULL;
