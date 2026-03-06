-- Remove day_quality column from journal_entries table
ALTER TABLE journal_entries DROP COLUMN IF EXISTS day_quality;