-- Break RLS recursion: promise_members SELECT referenced itself, and
-- promise_members INSERT checked promises whose SELECT referenced promise_members.

CREATE OR REPLACE FUNCTION public.is_promise_member(
    p_promise_id uuid,
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
        FROM public.promise_members
        WHERE promise_id = p_promise_id
          AND user_id = p_user_id
          AND invite_status != 'declined'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_accepted_promise_member(
    p_promise_id uuid,
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
        FROM public.promise_members
        WHERE promise_id = p_promise_id
          AND user_id = p_user_id
          AND invite_status = 'accepted'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_promise_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_accepted_promise_member(uuid, uuid) TO authenticated;

-- promise_members: no self-referencing subqueries in policies
DROP POLICY IF EXISTS "Members can view memberships in shared promises" ON promise_members;
CREATE POLICY "Members can view memberships in shared promises" ON promise_members
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM promises p
            WHERE p.id = promise_members.promise_id
              AND p.creator_id = auth.uid()
        )
        OR public.is_promise_member(promise_members.promise_id)
    );

-- promises: use helper instead of inline promise_members subquery
DROP POLICY IF EXISTS "Promise members can view promise" ON promises;
CREATE POLICY "Promise members can view promise" ON promises
    FOR SELECT USING (
        auth.uid() = creator_id
        OR public.is_promise_member(id)
    );

-- promise_progress_events: use helpers
DROP POLICY IF EXISTS "Promise members can view progress events" ON promise_progress_events;
DROP POLICY IF EXISTS "Members can insert own progress" ON promise_progress_events;
CREATE POLICY "Promise members can view progress events" ON promise_progress_events
    FOR SELECT USING (public.is_promise_member(promise_id));
CREATE POLICY "Members can insert own progress" ON promise_progress_events
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND public.is_accepted_promise_member(promise_id)
    );
