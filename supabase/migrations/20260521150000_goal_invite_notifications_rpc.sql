-- Reliable pending goal-invite lookup for the notifications inbox.
-- Avoids fragile client-side embeds/RLS edge cases for invitees.

CREATE OR REPLACE FUNCTION public.get_my_pending_goal_invites()
RETURNS TABLE (
    member_id uuid,
    promise_id uuid,
    created_at timestamptz,
    creator_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pm.id, pm.promise_id, pm.created_at, p.creator_id
    FROM promise_members pm
    INNER JOIN promises p ON p.id = pm.promise_id
    WHERE pm.user_id = auth.uid()
      AND pm.invite_status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_goal_invites() TO authenticated;

-- Allow goal creators to re-send invites (reset declined rows back to pending).
DROP POLICY IF EXISTS "Creator can update member invites" ON promise_members;
CREATE POLICY "Creator can update member invites" ON promise_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1
            FROM promises p
            WHERE p.id = promise_members.promise_id
              AND p.creator_id = auth.uid()
        )
    );
