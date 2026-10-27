-- A new phone pulls the whole account in one statement. Postgres cancels that
-- with "canceling statement due to statement timeout" (the API role's limit,
-- normally 8s): pull_sync_operations jsonb_aggs every operation since the
-- cursor, and pull_sync_snapshot rebuilds one JSON by calling the previous
-- snapshot and concatenating it.
--
-- Operations come back a page at a time. The cursor still moves only as far
-- as the rows actually returned. The snapshot is one query of the current
-- rows, and the public RPC may run longer than the role default so a cold
-- start can finish. See temporal-data-sync.md.

DROP FUNCTION pull_sync_operations(BIGINT, INT);

CREATE FUNCTION pull_sync_operations(
  since_sequence BIGINT DEFAULT 0,
  p_client_protocol INT DEFAULT 0,
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '20s'
AS $$
DECLARE
  uid UUID := auth.uid();
  epoch INT;
  operations JSONB;
  lim INT;
  extra BOOLEAN := FALSE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  epoch := sync_release_gate(p_client_protocol);
  -- A caller cannot ask for the unbounded aggregate this function used to run.
  lim := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);

  WITH page AS (
    SELECT o.*
    FROM sync_operations o
    WHERE o.user_id = uid
      AND o.server_sequence > COALESCE(since_sequence, 0)
    ORDER BY o.server_sequence
    LIMIT (lim + 1)
  )
  SELECT
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(s) ORDER BY s.server_sequence)
        FROM (
          SELECT page.*
          FROM page
          ORDER BY page.server_sequence
          LIMIT lim
        ) s
      ),
      '[]'::jsonb
    ),
    (SELECT COUNT(*) FROM page) > lim
  INTO operations, extra;

  IF COALESCE(p_client_protocol, 0) < 1 THEN
    RETURN operations;
  END IF;

  RETURN jsonb_build_object(
    'operations', operations,
    'data_epoch', epoch,
    'has_more', extra
  );
END;
$$;

ALTER FUNCTION pull_sync_operations(BIGINT, INT, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_operations(BIGINT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pull_sync_operations(BIGINT, INT, INT) TO authenticated;

-- One pass over the tables the client applies. The previous body called the
-- prior snapshot (itself a chain of copies) and also aggregated legacy
-- status-event and memo tables the client does not read.
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
    ),
    'compass_items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at)
       FROM compass_items c WHERE c.user_id = uid),
      '[]'::jsonb
    )
  );
END;
$$;

ALTER FUNCTION pull_sync_snapshot_ungated() OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot_ungated()
  FROM PUBLIC, anon, authenticated;

-- The RPC PostgREST calls. Its own limit has to move too: the timer starts
-- with the outer function, and the ungated body runs inside that statement.
ALTER FUNCTION pull_sync_snapshot(INT) SET statement_timeout = '50s';

NOTIFY pgrst, 'reload schema';
