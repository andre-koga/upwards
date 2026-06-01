-- Drop milestone columns that are no longer used from friend_daily_summaries.
-- The completions JSONB column stores per-activity data; milestone fields are
-- removed from the schema so old rows with those keys are harmlessly ignored.

ALTER TABLE public.friend_daily_summaries
  DROP COLUMN IF EXISTS milestone_prev,
  DROP COLUMN IF EXISTS milestone_next;

-- The completions JSONB array stored milestoneReached/milestonePrev/milestoneNext
-- inside each element. We strip those keys from all existing rows so the column
-- stays tidy going forward.
UPDATE public.friend_daily_summaries
SET completions = (
  SELECT jsonb_agg(
    elem - 'milestoneReached' - 'milestonePrev' - 'milestoneNext'
  )
  FROM jsonb_array_elements(completions) AS elem
)
WHERE completions IS NOT NULL;
