-- Per-user inbox dismissals. Partner progress events stay for goal accountability;
-- clearing a completion notification only records that this user dismissed it.

CREATE TABLE IF NOT EXISTS notification_dismissals (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user
    ON notification_dismissals(user_id, dismissed_at DESC);

ALTER TABLE notification_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification dismissals" ON notification_dismissals;
CREATE POLICY "Users manage own notification dismissals" ON notification_dismissals
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
