-- Journal entry video thumbnail
-- Adds a lightweight thumbnail column for offline-friendly video previews.

ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS video_thumbnail TEXT;

