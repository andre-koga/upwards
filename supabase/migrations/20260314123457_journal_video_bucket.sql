-- Journal video storage bucket
-- Idempotent migration to create a public bucket for journal videos
-- and restrict access to the owning user.

INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-videos', 'journal-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for journal-videos bucket
CREATE POLICY "Users can view their own journal videos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'journal-videos'
  AND auth.uid() = owner
);

CREATE POLICY "Users can upload their own journal videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'journal-videos'
  AND auth.uid() = owner
);

CREATE POLICY "Users can update their own journal videos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'journal-videos'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'journal-videos'
  AND auth.uid() = owner
);

CREATE POLICY "Users can delete their own journal videos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'journal-videos'
  AND auth.uid() = owner
);

