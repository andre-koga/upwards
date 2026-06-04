-- Add friend_daily_summaries table for unified daily recap sharing.
-- Users can share one summary per day containing all completed activities,
-- a caption, and milestone data. Friends can read it.

CREATE TABLE IF NOT EXISTS friend_daily_summaries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  caption TEXT,
  completed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  completions JSONB NOT NULL DEFAULT '[]',
  -- Each element: { activityName, streak, milestonePrev, milestoneNext, milestoneReached, routine }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_friend_daily_summaries_user
  ON friend_daily_summaries(user_id);

CREATE INDEX IF NOT EXISTS idx_friend_daily_summaries_created
  ON friend_daily_summaries(created_at DESC);

ALTER TABLE friend_daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can insert own summary" ON friend_daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own summary" ON friend_daily_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owner and friends can read summaries" ON friend_daily_summaries
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.user_a = LEAST(auth.uid(), user_id)
        AND f.user_b = GREATEST(auth.uid(), user_id)
    )
  );
