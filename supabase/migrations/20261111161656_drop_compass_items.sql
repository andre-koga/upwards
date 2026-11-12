-- The compass is removed.
--
-- North star, identity words, goals and the knowledge map were written by the
-- person and never read by anything else. The owner of every row asked for the
-- feature and its data to go, so this drops the table and unwinds the sync
-- wrapper that 20261019151050_compass_items.sql put in front of the operation
-- RPCs. Nothing else read compass_items.

-- submit_sync_operations_ungated ---------------------------------------------
-- The compass wrapper was only a router: compass ops to its own block, every
-- other op to the function it had renamed. Drop the router and give the
-- renamed function its name back.

DROP FUNCTION submit_sync_operations_ungated(JSONB);
ALTER FUNCTION submit_sync_operations_before_compass(JSONB)
  RENAME TO submit_sync_operations_ungated;

-- pull_sync_snapshot_ungated --------------------------------------------------
-- 20261027161817_page_sync_pulls.sql already replaced the wrapper with one
-- pass over the tables, compass_items included. Same body without it.

CREATE OR REPLACE FUNCTION pull_sync_snapshot_ungated()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '50s'
AS $$
DECLARE
  uid UUID := auth.uid();
  seq BIGINT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT COALESCE(MAX(server_sequence), 0) INTO seq
  FROM sync_operations
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'server_sequence', seq,
    'activity_groups', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM activity_groups t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'activities', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM activities t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'daily_entries', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM daily_entries t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'activity_periods', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(t))
        FROM activity_periods t
        WHERE t.user_id = uid
          AND (
            t.end_time IS NULL
            OR t.start_time IS DISTINCT FROM t.end_time
          )
      ),
      '[]'::jsonb
    ),
    'journal_entries', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM journal_entries t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'one_time_tasks', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM one_time_tasks t WHERE t.user_id = uid),
      '[]'::jsonb
    ),
    'memories', COALESCE(
      (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at)
       FROM memories m WHERE m.user_id = uid),
      '[]'::jsonb
    ),
    'journal_entry_revisions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
       FROM journal_entry_revisions r WHERE r.user_id = uid),
      '[]'::jsonb
    )
  );
END;
$$;

ALTER FUNCTION pull_sync_snapshot_ungated() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot_ungated()
  FROM PUBLIC, anon, authenticated;

-- The wrapper's renamed predecessor has been unreachable since the replacement
-- above.
DROP FUNCTION IF EXISTS pull_sync_snapshot_before_compass();

-- The data --------------------------------------------------------------------
-- The operation log would otherwise hand a build that no longer knows the
-- entity type operations it cannot apply.

DELETE FROM sync_operations WHERE entity_type = 'compass_item';

DROP TABLE compass_items;

NOTIFY pgrst, 'reload schema';
