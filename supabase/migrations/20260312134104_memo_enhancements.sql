-- Memo enhancements: pin, due date, time tracking
-- Adds is_pinned, due_date to one_time_tasks; current_memo_id to daily_entries; memo_periods table

ALTER TABLE one_time_tasks ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE one_time_tasks ADD COLUMN IF NOT EXISTS due_date TEXT;

ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS current_memo_id UUID;

CREATE TABLE IF NOT EXISTS memo_periods (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_entry_id UUID REFERENCES daily_entries(id) ON DELETE CASCADE,
    one_time_task_id UUID REFERENCES one_time_tasks(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_memo_periods_user_id ON memo_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_memo_periods_daily_entry_id ON memo_periods(daily_entry_id);
CREATE INDEX IF NOT EXISTS idx_memo_periods_one_time_task_id ON memo_periods(one_time_task_id);
CREATE INDEX IF NOT EXISTS idx_memo_periods_deleted_at ON memo_periods(deleted_at);

ALTER TABLE memo_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own memo periods" ON memo_periods;
DROP POLICY IF EXISTS "Users can insert their own memo periods" ON memo_periods;
DROP POLICY IF EXISTS "Users can update their own memo periods" ON memo_periods;
DROP POLICY IF EXISTS "Users can delete their own memo periods" ON memo_periods;
CREATE POLICY "Users can view their own memo periods" ON memo_periods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own memo periods" ON memo_periods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own memo periods" ON memo_periods FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own memo periods" ON memo_periods FOR DELETE USING (auth.uid() = user_id);
