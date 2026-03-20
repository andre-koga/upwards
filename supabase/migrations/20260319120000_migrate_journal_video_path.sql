ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS video_path TEXT;

UPDATE journal_entries
SET video_path = CASE
  WHEN youtube_url IS NULL OR BTRIM(youtube_url) = '' THEN video_path
  WHEN POSITION('/storage/v1/object/public/journal-videos/' IN youtube_url) > 0
    THEN SPLIT_PART(youtube_url, '/storage/v1/object/public/journal-videos/', 2)
  ELSE youtube_url
END
WHERE (video_path IS NULL OR BTRIM(video_path) = '')
  AND youtube_url IS NOT NULL;

ALTER TABLE journal_entries
DROP COLUMN IF EXISTS youtube_url;