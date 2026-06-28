-- Recurring memo presets (templates) and link from spawned one_time_tasks instances.

CREATE TABLE IF NOT EXISTS recurring_memos (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    routine TEXT NOT NULL DEFAULT 'daily',
    is_pinned BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_memos_user_id ON recurring_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_memos_deleted_at ON recurring_memos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_recurring_memos_server_updated_at
  ON recurring_memos(user_id, server_updated_at);

DROP TRIGGER IF EXISTS trg_recurring_memos_server_updated_at ON recurring_memos;
CREATE TRIGGER trg_recurring_memos_server_updated_at
  BEFORE INSERT OR UPDATE ON recurring_memos
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

ALTER TABLE recurring_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recurring memos" ON recurring_memos;
DROP POLICY IF EXISTS "Users can insert their own recurring memos" ON recurring_memos;
DROP POLICY IF EXISTS "Users can update their own recurring memos" ON recurring_memos;
DROP POLICY IF EXISTS "Users can delete their own recurring memos" ON recurring_memos;

CREATE POLICY "Users can view their own recurring memos"
  ON recurring_memos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recurring memos"
  ON recurring_memos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recurring memos"
  ON recurring_memos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recurring memos"
  ON recurring_memos FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE one_time_tasks
  ADD COLUMN IF NOT EXISTS recurring_memo_id UUID REFERENCES recurring_memos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_one_time_tasks_recurring_memo_id
  ON one_time_tasks(recurring_memo_id);
