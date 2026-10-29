-- The weekly letter is removed (product-scope.md, Removed, 2026-10-29).
-- journal_letters was a derived cache, not user-authored history. The journal
-- rows stay. journal_reading was only the switch for that letter.

DROP TABLE IF EXISTS journal_letters;

ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS journal_reading;

NOTIFY pgrst, 'reload schema';
