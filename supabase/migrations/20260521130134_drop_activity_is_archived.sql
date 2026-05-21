-- Archive is group-only. Activities no longer carry their own is_archived flag;
-- an activity is considered archived iff its parent group is archived.
ALTER TABLE activities DROP COLUMN IF EXISTS is_archived;
