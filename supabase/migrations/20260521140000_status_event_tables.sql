-- Append-only status history for date-aware For Today / timeline behavior.

CREATE TABLE IF NOT EXISTS activity_status_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    status_type TEXT NOT NULL CHECK (status_type IN ('completed', 'deleted')),
    next_value BOOLEAN NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_activity_status_events_user_id
    ON activity_status_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_status_events_entity_id
    ON activity_status_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_status_events_effective_at
    ON activity_status_events(effective_at);
CREATE INDEX IF NOT EXISTS idx_activity_status_events_deleted_at
    ON activity_status_events(deleted_at);

CREATE TABLE IF NOT EXISTS group_status_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES activity_groups(id) ON DELETE CASCADE,
    status_type TEXT NOT NULL CHECK (status_type IN ('archived', 'deleted')),
    next_value BOOLEAN NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_group_status_events_user_id
    ON group_status_events(user_id);
CREATE INDEX IF NOT EXISTS idx_group_status_events_entity_id
    ON group_status_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_group_status_events_effective_at
    ON group_status_events(effective_at);
CREATE INDEX IF NOT EXISTS idx_group_status_events_deleted_at
    ON group_status_events(deleted_at);

ALTER TABLE activity_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity status events"
    ON activity_status_events;
DROP POLICY IF EXISTS "Users can insert their own activity status events"
    ON activity_status_events;
DROP POLICY IF EXISTS "Users can update their own activity status events"
    ON activity_status_events;
DROP POLICY IF EXISTS "Users can delete their own activity status events"
    ON activity_status_events;
CREATE POLICY "Users can view their own activity status events"
    ON activity_status_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity status events"
    ON activity_status_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activity status events"
    ON activity_status_events FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activity status events"
    ON activity_status_events FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own group status events"
    ON group_status_events;
DROP POLICY IF EXISTS "Users can insert their own group status events"
    ON group_status_events;
DROP POLICY IF EXISTS "Users can update their own group status events"
    ON group_status_events;
DROP POLICY IF EXISTS "Users can delete their own group status events"
    ON group_status_events;
CREATE POLICY "Users can view their own group status events"
    ON group_status_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own group status events"
    ON group_status_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own group status events"
    ON group_status_events FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own group status events"
    ON group_status_events FOR DELETE USING (auth.uid() = user_id);
