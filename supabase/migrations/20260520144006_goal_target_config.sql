-- Add configurable streak targets to goals.
-- Two kinds: 'streak_count' (reach N) and 'streak_until' (keep streak alive until date).
-- Nullable so existing rows remain valid; all new goals will always set target_kind.

ALTER TABLE promises
    ADD COLUMN IF NOT EXISTS target_kind TEXT,
    ADD COLUMN IF NOT EXISTS target_streak INTEGER,
    ADD COLUMN IF NOT EXISTS target_end_date DATE;

ALTER TABLE promises
    ADD CONSTRAINT goal_target_shape CHECK (
        target_kind IS NULL
        OR (target_kind = 'streak_count' AND target_streak IS NOT NULL AND target_end_date IS NULL)
        OR (target_kind = 'streak_until' AND target_end_date IS NOT NULL AND target_streak IS NULL)
    );

-- Deduplicate active goals: keep the newest, cancel the rest.
UPDATE promises
SET status = 'cancelled'
WHERE status = 'active'
  AND id NOT IN (
      SELECT DISTINCT ON (creator_id, creator_activity_id) id
      FROM promises
      WHERE status = 'active'
      ORDER BY creator_id, creator_activity_id, created_at DESC
  );

-- Enforce one active goal per activity per creator.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_goal_per_activity
    ON promises (creator_id, creator_activity_id)
    WHERE status = 'active';
