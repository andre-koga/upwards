-- Add total_tracked_ms to friend_daily_summaries so the friend recap dialog
-- can display the same tracked-time line as the user's own recap dialog.

ALTER TABLE public.friend_daily_summaries
  ADD COLUMN IF NOT EXISTS total_tracked_ms BIGINT NOT NULL DEFAULT 0;
