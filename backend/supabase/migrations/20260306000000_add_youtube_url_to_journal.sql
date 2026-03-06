-- Add youtube_url column to journal_entries for daily vlog links
ALTER TABLE journal_entries
ADD COLUMN youtube_url TEXT;
-- Optional: constrain to reasonable URL length
ALTER TABLE journal_entries
ADD CONSTRAINT youtube_url_length_check CHECK (char_length(youtube_url) <= 500);