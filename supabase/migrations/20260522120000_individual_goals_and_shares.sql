-- Individual goals with read-only sharing.
-- Reshape promises as owner-only goals; replace promise_members with goal_shares.

ALTER TABLE promises RENAME COLUMN creator_id TO user_id;
ALTER TABLE promises RENAME COLUMN creator_activity_id TO activity_id;
ALTER TABLE promises RENAME COLUMN creator_activity_name TO activity_name;
ALTER TABLE promises RENAME COLUMN title TO name;
ALTER TABLE promises RENAME COLUMN objective TO description;

CREATE TABLE IF NOT EXISTS goal_shares (
    id UUID PRIMARY KEY,
    goal_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'stopped')),
    created_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ,
    UNIQUE(goal_id, viewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_shares_goal_id ON goal_shares(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_shares_viewer_id ON goal_shares(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_goal_shares_owner_id ON goal_shares(owner_user_id);

INSERT INTO goal_shares (id, goal_id, owner_user_id, viewer_user_id, status, created_at, responded_at)
SELECT
    pm.id,
    pm.promise_id,
    p.user_id,
    pm.user_id,
    CASE pm.invite_status
        WHEN 'accepted' THEN 'accepted'
        WHEN 'declined' THEN 'declined'
        ELSE 'pending'
    END,
    pm.created_at,
    pm.joined_at
FROM promise_members pm
INNER JOIN promises p ON p.id = pm.promise_id
WHERE pm.user_id <> p.user_id
ON CONFLICT (goal_id, viewer_user_id) DO NOTHING;

DROP TABLE IF EXISTS promise_members CASCADE;

DROP INDEX IF EXISTS uq_one_active_goal_per_activity;
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_goal_per_activity
    ON promises (user_id, activity_id)
    WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.is_goal_viewer(
    p_goal_id uuid,
    p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.goal_shares gs
        WHERE gs.goal_id = p_goal_id
          AND gs.viewer_user_id = p_user_id
          AND gs.status = 'accepted'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_goal(
    p_goal_id uuid,
    p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.promises g
        WHERE g.id = p_goal_id
          AND g.user_id = p_user_id
    )
    OR public.is_goal_viewer(p_goal_id, p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_goal_viewer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_goal(uuid, uuid) TO authenticated;

-- Drop policies that reference legacy member helpers before dropping those functions.
DROP POLICY IF EXISTS "Promise members can view promise" ON promises;
DROP POLICY IF EXISTS "Promise members can view progress events" ON promise_progress_events;
DROP POLICY IF EXISTS "Members can insert own progress" ON promise_progress_events;
DROP POLICY IF EXISTS "Creator can insert promise" ON promises;
DROP POLICY IF EXISTS "Creator can update promise" ON promises;

DROP FUNCTION IF EXISTS public.is_promise_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_accepted_promise_member(uuid, uuid);

CREATE POLICY "Owner can insert goal" ON promises
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update goal" ON promises
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owner or viewer can view goal" ON promises
    FOR SELECT USING (public.can_view_goal(id));

ALTER TABLE goal_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or viewer can view share" ON goal_shares
    FOR SELECT USING (
        auth.uid() = owner_user_id
        OR auth.uid() = viewer_user_id
    );

CREATE POLICY "Owner can insert share" ON goal_shares
    FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owner can update share" ON goal_shares
    FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Owner can delete share" ON goal_shares
    FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Viewer can respond to share" ON goal_shares
    FOR UPDATE USING (auth.uid() = viewer_user_id);

CREATE POLICY "Goal viewers can read progress events" ON promise_progress_events
    FOR SELECT USING (public.can_view_goal(promise_id));

CREATE POLICY "Goal owner can insert progress" ON promise_progress_events
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM promises g
            WHERE g.id = promise_progress_events.promise_id
              AND g.user_id = auth.uid()
              AND g.status = 'active'
        )
    );

CREATE POLICY "Goal owner can update progress" ON promise_progress_events
    FOR UPDATE USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM promises g
            WHERE g.id = promise_progress_events.promise_id
              AND g.user_id = auth.uid()
        )
    );

DROP FUNCTION IF EXISTS public.get_my_pending_goal_invites();

CREATE OR REPLACE FUNCTION public.get_my_pending_goal_shares()
RETURNS TABLE (
    share_id uuid,
    goal_id uuid,
    created_at timestamptz,
    owner_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT gs.id, gs.goal_id, gs.created_at, gs.owner_user_id
    FROM goal_shares gs
    WHERE gs.viewer_user_id = auth.uid()
      AND gs.status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_goal_shares() TO authenticated;
