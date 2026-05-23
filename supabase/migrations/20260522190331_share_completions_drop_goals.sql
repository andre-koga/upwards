-- Share completions on activities; friend completion feed; remove goals system.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS share_completions_with_friends BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS friend_activity_completions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  date DATE NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  milestone_prev INTEGER NOT NULL DEFAULT 0,
  milestone_next INTEGER NOT NULL DEFAULT 1,
  routine TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, activity_id, date)
);

CREATE INDEX IF NOT EXISTS idx_friend_activity_completions_user
  ON friend_activity_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_activity_completions_created
  ON friend_activity_completions(created_at DESC);

ALTER TABLE friend_activity_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can insert own completions" ON friend_activity_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner and friends can read completions" ON friend_activity_completions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.user_a = LEAST(auth.uid(), user_id)
        AND f.user_b = GREATEST(auth.uid(), user_id)
    )
  );

-- Drop goals / promises
DROP POLICY IF EXISTS "Viewer can respond to share" ON goal_shares;
DROP POLICY IF EXISTS "Owner can delete share" ON goal_shares;
DROP POLICY IF EXISTS "Owner can update share" ON goal_shares;
DROP POLICY IF EXISTS "Owner can insert share" ON goal_shares;
DROP POLICY IF EXISTS "Owner or viewer can view share" ON goal_shares;

DROP POLICY IF EXISTS "Goal owner can update progress" ON promise_progress_events;
DROP POLICY IF EXISTS "Goal owner can insert progress" ON promise_progress_events;
DROP POLICY IF EXISTS "Goal viewers can read progress events" ON promise_progress_events;

DROP POLICY IF EXISTS "Owner or viewer can view goal" ON promises;
DROP POLICY IF EXISTS "Owner can update goal" ON promises;
DROP POLICY IF EXISTS "Owner can insert goal" ON promises;

DROP FUNCTION IF EXISTS public.get_my_pending_goal_shares();
DROP FUNCTION IF EXISTS public.get_my_pending_goal_invites();
DROP FUNCTION IF EXISTS public.can_view_goal(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_goal_viewer(uuid, uuid);

DROP TABLE IF EXISTS goal_shares CASCADE;
DROP TABLE IF EXISTS promise_progress_events CASCADE;
DROP TABLE IF EXISTS promises CASCADE;
