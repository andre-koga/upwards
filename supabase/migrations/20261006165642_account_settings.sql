-- Account settings and opt-ins (A9). See docs/architecture/product-scope.md
-- §2.5, §2.7, §2.8.
--
-- The settings follow the account across devices, so they live on the existing
-- user_profiles row. Every column is nullable: NULL means "never chosen", which
-- is different from "off" (a device can then infer a sensible default once,
-- such as turning the daily clip on for an account that already has clips).

ALTER TABLE user_profiles
  -- Add the day's location to the journal automatically. Off unless chosen.
  ADD COLUMN auto_location BOOLEAN,
  -- Show the daily clip slot, the video filter, and clip posters.
  ADD COLUMN daily_clip BOOLEAN,
  -- Holiday calendars to show, e.g. {'US','BR','GLOBAL','HINDU'}. Used by A11.
  ADD COLUMN holiday_calendars TEXT[],
  -- Which seasons the month banners follow. Used by A11.
  ADD COLUMN hemisphere TEXT CHECK (hemisphere IN ('north', 'south'));

-- These columns are private settings. The "view any profile" policy came from
-- the removed friends feature (nothing reads another user's profile any more),
-- so replace it with own-row access before the table holds anything private.
DROP POLICY IF EXISTS "Users can view any profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = user_id);

-- The existing update policy has no WITH CHECK, so it did not stop a user from
-- reassigning a row to someone else. Pin it to the owner.
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
