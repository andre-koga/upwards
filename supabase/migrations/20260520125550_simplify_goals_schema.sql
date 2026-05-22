-- Phase 0: Simplify the goals (promises) schema.
-- Drop unused tables, remove over-engineered columns, add a unique constraint
-- on progress events so inserts are idempotent.

-- Drop token-based invite table (replaced by friend-based pending member rows)
DROP TABLE IF EXISTS promise_invites;

-- Drop reactions table (deferred feature)
DROP TABLE IF EXISTS promise_reactions;

-- Drop over-engineered columns from promise_members
ALTER TABLE promise_members DROP COLUMN IF EXISTS role;
ALTER TABLE promise_members DROP COLUMN IF EXISTS display_name;

-- Drop over-engineered columns from promises
ALTER TABLE promises DROP COLUMN IF EXISTS mode;
ALTER TABLE promises DROP COLUMN IF EXISTS title;

-- Drop kind column from progress events (only daily_complete remains)
ALTER TABLE promise_progress_events DROP COLUMN IF EXISTS kind;

-- Add unique constraint so ON CONFLICT DO NOTHING is safe (idempotent emit)
ALTER TABLE promise_progress_events
    DROP CONSTRAINT IF EXISTS uq_ppe_promise_user_date;
ALTER TABLE promise_progress_events
    ADD CONSTRAINT uq_ppe_promise_user_date UNIQUE (promise_id, user_id, date);
