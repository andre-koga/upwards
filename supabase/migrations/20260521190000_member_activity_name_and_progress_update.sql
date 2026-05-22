-- Store each member's linked habit name for partners who cannot resolve local activity ids.
ALTER TABLE promise_members
    ADD COLUMN IF NOT EXISTS member_activity_name TEXT;

-- Backfill from the latest progress event per member.
UPDATE promise_members pm
SET member_activity_name = sub.activity_name
FROM (
    SELECT DISTINCT ON (promise_id, user_id)
        promise_id,
        user_id,
        payload->>'activityName' AS activity_name
    FROM promise_progress_events
    WHERE payload->>'activityName' IS NOT NULL
      AND payload->>'activityName' <> ''
    ORDER BY promise_id, user_id, date DESC, created_at DESC
) sub
WHERE pm.promise_id = sub.promise_id
  AND pm.user_id = sub.user_id
  AND pm.member_activity_name IS NULL;

-- Backfill creator rows from the promise record.
UPDATE promise_members pm
SET member_activity_name = p.creator_activity_name
FROM promises p
WHERE pm.promise_id = p.id
  AND pm.user_id = p.creator_id
  AND pm.member_activity_name IS NULL
  AND p.creator_activity_name IS NOT NULL;

-- Allow members to merge/update their own daily progress rows (upsert path).
DROP POLICY IF EXISTS "Members can update own progress" ON promise_progress_events;
CREATE POLICY "Members can update own progress" ON promise_progress_events
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
