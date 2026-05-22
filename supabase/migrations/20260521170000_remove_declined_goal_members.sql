-- Declining a goal invite removes the membership row instead of leaving a declined stub.
DROP POLICY IF EXISTS "Member can delete own pending invite" ON promise_members;
CREATE POLICY "Member can delete own pending invite" ON promise_members
    FOR DELETE USING (
        auth.uid() = user_id
        AND invite_status = 'pending'
    );

-- Clean up legacy declined rows so creators can re-invite cleanly.
DELETE FROM promise_members
WHERE invite_status = 'declined';
