-- Journal photos storage bucket and photo_paths column
-- Creates a public bucket for journal photos with per-owner RLS,
-- and adds photo_paths TEXT[] to journal_entries.

INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-photos', 'journal-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for journal-photos bucket
CREATE POLICY "Users can view their own journal photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'journal-photos'
  AND auth.uid() = owner
);

CREATE POLICY "Users can upload their own journal photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'journal-photos'
  AND auth.uid() = owner
);

CREATE POLICY "Users can update their own journal photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'journal-photos'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'journal-photos'
  AND auth.uid() = owner
);

CREATE POLICY "Users can delete their own journal photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'journal-photos'
  AND auth.uid() = owner
);

-- Add photo_paths column to journal_entries
ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS photo_paths TEXT[] DEFAULT NULL;
