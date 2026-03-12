-- OkHabit Initial Schema
-- Idempotent migration for local dev and cloud sync.
-- Mirrors the local IndexedDB structure for offline-first sync.

-- Activity Groups Table
CREATE TABLE IF NOT EXISTS activity_groups (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    order_index INTEGER,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_activity_groups_user_id ON activity_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_groups_deleted_at ON activity_groups(deleted_at);

-- Activities Table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES activity_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pattern TEXT,
    routine TEXT,
    completion_target INTEGER,
    color TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    order_index INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_group_id ON activities(group_id);
CREATE INDEX IF NOT EXISTS idx_activities_deleted_at ON activities(deleted_at);

-- Daily Entries Table
CREATE TABLE IF NOT EXISTS daily_entries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    task_counts JSONB,
    current_activity_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_entries_user_id ON daily_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_deleted_at ON daily_entries(deleted_at);

-- Activity Periods Table
CREATE TABLE IF NOT EXISTS activity_periods (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_entry_id UUID REFERENCES daily_entries(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_activity_periods_user_id ON activity_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_periods_daily_entry_id ON activity_periods(daily_entry_id);
CREATE INDEX IF NOT EXISTS idx_activity_periods_activity_id ON activity_periods(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_periods_deleted_at ON activity_periods(deleted_at);

-- Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL,
    title TEXT,
    text_content TEXT,
    day_emoji TEXT,
    is_bookmarked BOOLEAN DEFAULT FALSE,
    youtube_url TEXT,
    is_journal_complete BOOLEAN DEFAULT FALSE,
    journal_entry_number INTEGER,
    journal_completion_streak INTEGER,
    journal_completed_at TIMESTAMPTZ,
    location JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    UNIQUE(user_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_is_bookmarked ON journal_entries(is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_journal_entries_deleted_at ON journal_entries(deleted_at);

-- One Time Tasks Table
CREATE TABLE IF NOT EXISTS one_time_tasks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date TEXT,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    order_index INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_one_time_tasks_user_id ON one_time_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_one_time_tasks_date ON one_time_tasks(date);
CREATE INDEX IF NOT EXISTS idx_one_time_tasks_deleted_at ON one_time_tasks(deleted_at);

-- Activity Streaks Table
CREATE TABLE IF NOT EXISTS activity_streaks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    streak INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    UNIQUE(user_id, activity_id, date)
);
CREATE INDEX IF NOT EXISTS idx_activity_streaks_user_id ON activity_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_streaks_activity_id ON activity_streaks(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_streaks_date ON activity_streaks(date);
CREATE INDEX IF NOT EXISTS idx_activity_streaks_deleted_at ON activity_streaks(deleted_at);

-- Row Level Security (RLS)
ALTER TABLE activity_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_time_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_streaks ENABLE ROW LEVEL SECURITY;

-- activity_groups policies
DROP POLICY IF EXISTS "Users can view their own activity groups" ON activity_groups;
DROP POLICY IF EXISTS "Users can insert their own activity groups" ON activity_groups;
DROP POLICY IF EXISTS "Users can update their own activity groups" ON activity_groups;
DROP POLICY IF EXISTS "Users can delete their own activity groups" ON activity_groups;
CREATE POLICY "Users can view their own activity groups" ON activity_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity groups" ON activity_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activity groups" ON activity_groups FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activity groups" ON activity_groups FOR DELETE USING (auth.uid() = user_id);

-- activities policies
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;
CREATE POLICY "Users can view their own activities" ON activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activities" ON activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activities" ON activities FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activities" ON activities FOR DELETE USING (auth.uid() = user_id);

-- daily_entries policies
DROP POLICY IF EXISTS "Users can view their own daily entries" ON daily_entries;
DROP POLICY IF EXISTS "Users can insert their own daily entries" ON daily_entries;
DROP POLICY IF EXISTS "Users can update their own daily entries" ON daily_entries;
DROP POLICY IF EXISTS "Users can delete their own daily entries" ON daily_entries;
CREATE POLICY "Users can view their own daily entries" ON daily_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own daily entries" ON daily_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own daily entries" ON daily_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own daily entries" ON daily_entries FOR DELETE USING (auth.uid() = user_id);

-- activity_periods policies
DROP POLICY IF EXISTS "Users can view their own activity periods" ON activity_periods;
DROP POLICY IF EXISTS "Users can insert their own activity periods" ON activity_periods;
DROP POLICY IF EXISTS "Users can update their own activity periods" ON activity_periods;
DROP POLICY IF EXISTS "Users can delete their own activity periods" ON activity_periods;
CREATE POLICY "Users can view their own activity periods" ON activity_periods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity periods" ON activity_periods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activity periods" ON activity_periods FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activity periods" ON activity_periods FOR DELETE USING (auth.uid() = user_id);

-- journal_entries policies
DROP POLICY IF EXISTS "Users can view their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can update their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete their own journal entries" ON journal_entries;
CREATE POLICY "Users can view their own journal entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own journal entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own journal entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own journal entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);

-- one_time_tasks policies
DROP POLICY IF EXISTS "Users can view their own one time tasks" ON one_time_tasks;
DROP POLICY IF EXISTS "Users can insert their own one time tasks" ON one_time_tasks;
DROP POLICY IF EXISTS "Users can update their own one time tasks" ON one_time_tasks;
DROP POLICY IF EXISTS "Users can delete their own one time tasks" ON one_time_tasks;
CREATE POLICY "Users can view their own one time tasks" ON one_time_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own one time tasks" ON one_time_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own one time tasks" ON one_time_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own one time tasks" ON one_time_tasks FOR DELETE USING (auth.uid() = user_id);

-- activity_streaks policies
DROP POLICY IF EXISTS "Users can view their own activity streaks" ON activity_streaks;
DROP POLICY IF EXISTS "Users can insert their own activity streaks" ON activity_streaks;
DROP POLICY IF EXISTS "Users can update their own activity streaks" ON activity_streaks;
DROP POLICY IF EXISTS "Users can delete their own activity streaks" ON activity_streaks;
CREATE POLICY "Users can view their own activity streaks" ON activity_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity streaks" ON activity_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activity streaks" ON activity_streaks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activity streaks" ON activity_streaks FOR DELETE USING (auth.uid() = user_id);
