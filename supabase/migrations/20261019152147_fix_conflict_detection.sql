-- Fix how the server decides a projection edit is stale, and let the API role
-- read memories. See docs/architecture/temporal-data-sync.md (Merge rules).
--
-- 1. The check compared `updated_at::TEXT` with the client's ISO string.
--    Postgres renders 2026-10-19 10:00:00+00, the client sends
--    2026-10-19T10:00:00.000Z, and a space sorts below 'T', so the answer came
--    from the date part alone:
--      * tasks, activities, groups, journal and sessions (`remote > base`):
--        a stale edit made on the SAME calendar day as the version it replaces
--        was accepted, a silent last-write-wins;
--      * memories (`IS DISTINCT FROM`): every edit conflicted, even one based on
--        the current version.
--    Both now ask "is the server's version strictly newer than the base?",
--    compared as timestamps. "Newer", not "different": the client collapses
--    several offline edits into one operation whose base is its own previous
--    edit, which the server has never seen, so an exact match would flag it.
--
-- 2. memories was created after the one-off "grant on all tables" migration
--    (20260825190200) and so has no SELECT for the API role. Conflict review
--    reads a conflicting row's other version straight from the table, and a
--    memory can conflict. journal_entry_revisions has the same gap on purpose
--    left open: it is append-only, never conflicts, and nothing reads it
--    directly, so granting it would only widen access.

-- Parse the two timestamp spellings, or NULL when the text is not a timestamp.
CREATE FUNCTION sync_parse_ts(value TEXT) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN NULLIF(value, '')::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Is the server's version strictly newer than the one the client edited?
-- When either side is not a timestamp (a legacy opaque base), fall back to the
-- text comparison the callers used before, so nothing that worked stops.
CREATE FUNCTION sync_row_is_newer(remote TEXT, base TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  remote_ts TIMESTAMPTZ := sync_parse_ts(remote);
  base_ts TIMESTAMPTZ := sync_parse_ts(base);
BEGIN
  IF remote_ts IS NOT NULL AND base_ts IS NOT NULL THEN
    RETURN remote_ts > base_ts;
  END IF;
  RETURN remote > base;
END;
$$;

REVOKE ALL ON FUNCTION sync_parse_ts(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_row_is_newer(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Patch one comparison inside an existing function, in place, and fail the
-- whole migration if the text to replace is not there exactly once. The two
-- functions are large and a third of the sync protocol; the diff worth
-- reviewing is the one line, not a copy of the rest.
CREATE FUNCTION pg_temp.patch_function(
  fn REGPROCEDURE, old_text TEXT, new_text TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  def TEXT := pg_get_functiondef(fn);
  hits INT := (length(def) - length(replace(def, old_text, ''))) / length(old_text);
BEGIN
  IF hits <> 1 THEN
    RAISE EXCEPTION 'expected exactly one "%" in %, found %', old_text, fn, hits;
  END IF;
  EXECUTE replace(def, old_text, new_text);
END;
$$;

-- Tasks, activities, groups, journal entries and sessions.
SELECT pg_temp.patch_function(
  'submit_sync_operations_existing(jsonb)'::regprocedure,
  'IF remote_updated IS NOT NULL AND remote_updated > base_revision THEN',
  'IF remote_updated IS NOT NULL AND sync_row_is_newer(remote_updated, base_revision) THEN');

-- Memories.
SELECT pg_temp.patch_function(
  'submit_sync_operations_before_revisions(jsonb)'::regprocedure,
  'remote_updated IS DISTINCT FROM base_revision',
  'sync_row_is_newer(remote_updated, base_revision)');

GRANT SELECT ON memories TO authenticated;

NOTIFY pgrst, 'reload schema';
