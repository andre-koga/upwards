-- Journal reading, step 1 (product-scope.md §2.12).
--
-- journal_reading NULL means never chosen, which is off. The app does not
-- infer it on. journal_letters is a derived cache the edge function writes.
-- The owner can read and delete their rows (clear). They cannot insert.

ALTER TABLE user_profiles
  ADD COLUMN journal_reading BOOLEAN;

CREATE TABLE journal_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  fingerprint TEXT NOT NULL,
  paragraphs JSONB NOT NULL,
  experiment JSONB,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

ALTER TABLE journal_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own letters"
  ON journal_letters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own letters"
  ON journal_letters FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, DELETE ON journal_letters TO authenticated;

NOTIFY pgrst, 'reload schema';
