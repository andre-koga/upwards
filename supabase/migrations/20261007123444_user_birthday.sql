-- Your own birthday (A12). See docs/architecture/product-scope.md §2.8.
--
-- A full date of birth, so it is personal data: it lives on the user's own
-- profile row (own-row access only since A9), is never sent to the AI provider
-- or analytics, and is optional. NULL means never entered.
ALTER TABLE user_profiles
  ADD COLUMN birthday DATE
  CHECK (birthday IS NULL OR (birthday >= DATE '1900-01-01' AND birthday <= CURRENT_DATE));

NOTIFY pgrst, 'reload schema';
