-- Per-user bring-your-own-key AI settings for generated insights.
-- This table is never read or written directly by the client: both the
-- Settings "save/test" flow and the insight-generation flow go through
-- edge functions using the service-role key. RLS is enabled with no
-- policies for authenticated/anon, so a stolen client JWT cannot read or
-- write this row directly (service_role bypasses RLS as usual).
CREATE TABLE user_ai_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT NOT NULL,
  -- Lightweight daily cap so a buggy client can't burn through a user's key budget.
  calls_today INT NOT NULL DEFAULT 0,
  calls_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service-role client (edge functions) reads/writes this table.
