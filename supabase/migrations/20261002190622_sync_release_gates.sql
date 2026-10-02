-- Release gates: protocol version, data epoch, device heartbeat.
-- See docs/architecture/product-scope.md §4.1–4.2 (A1) and temporal-data-sync.md.
--
-- Operators change the gates with plain SQL, inside a migration window:
--   UPDATE app_config SET min_client_protocol = <n>;   -- turn away older builds
--   UPDATE app_config SET data_epoch = data_epoch + 1; -- make devices re-bootstrap
--
-- Future edits to the sync RPC bodies go to the *_ungated functions. The public
-- names below only gate and reshape; redefining them with the old one-argument
-- signatures would create an ungated overload.

CREATE TABLE app_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  min_client_protocol INT NOT NULL DEFAULT 0 CHECK (min_client_protocol >= 0),
  data_epoch INT NOT NULL DEFAULT 0 CHECK (data_epoch >= 0)
);

INSERT INTO app_config (id) VALUES (TRUE);

-- No policies: clients read the gates only through the sync RPCs.
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON app_config TO service_role;

-- server_updated_at is what trg_sync_devices_updated_at (set_server_updated_at)
-- writes; without it every device upsert has failed since the table was created.
ALTER TABLE sync_devices
  ADD COLUMN server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN client_protocol INT CHECK (client_protocol >= 0),
  ADD COLUMN local_schema_version INT CHECK (local_schema_version >= 0),
  ADD COLUMN pending_count INT CHECK (pending_count >= 0);

-- Raises client_outdated below the minimum; otherwise returns the data epoch.
CREATE FUNCTION sync_release_gate(p_client_protocol INT)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_protocol INT;
  epoch INT;
BEGIN
  SELECT c.min_client_protocol, c.data_epoch
  INTO min_protocol, epoch
  FROM app_config c
  WHERE c.id;

  IF COALESCE(p_client_protocol, 0) < COALESCE(min_protocol, 0) THEN
    RAISE EXCEPTION 'client_outdated'
      USING DETAIL = format(
        'client_protocol=%s min_client_protocol=%s',
        COALESCE(p_client_protocol, 0),
        min_protocol
      ),
      HINT = 'Update the app to keep syncing.';
  END IF;

  RETURN COALESCE(epoch, 0);
END;
$$;

ALTER FUNCTION sync_release_gate(INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION sync_release_gate(INT) FROM PUBLIC, anon, authenticated;

-- submit_sync_operations ------------------------------------------------------

ALTER FUNCTION submit_sync_operations(JSONB) RENAME TO submit_sync_operations_ungated;
REVOKE ALL ON FUNCTION submit_sync_operations_ungated(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION submit_sync_operations_existing(JSONB) FROM PUBLIC, anon, authenticated;

-- Protocol 0 keeps the legacy bare-array response so builds that predate the
-- gate keep syncing until min_client_protocol is raised.
CREATE FUNCTION submit_sync_operations(
  ops JSONB,
  p_client_protocol INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  epoch INT;
  results JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  epoch := sync_release_gate(p_client_protocol);
  results := submit_sync_operations_ungated(ops);

  IF COALESCE(p_client_protocol, 0) < 1 THEN
    RETURN results;
  END IF;
  RETURN jsonb_build_object('results', results, 'data_epoch', epoch);
END;
$$;

ALTER FUNCTION submit_sync_operations(JSONB, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION submit_sync_operations(JSONB, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_sync_operations(JSONB, INT) TO authenticated;

-- pull_sync_operations --------------------------------------------------------

DROP FUNCTION pull_sync_operations(BIGINT);

CREATE FUNCTION pull_sync_operations(
  since_sequence BIGINT DEFAULT 0,
  p_client_protocol INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  epoch INT;
  operations JSONB;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  epoch := sync_release_gate(p_client_protocol);

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.server_sequence), '[]'::jsonb)
  INTO operations
  FROM sync_operations o
  WHERE o.user_id = uid
    AND o.server_sequence > COALESCE(since_sequence, 0);

  IF COALESCE(p_client_protocol, 0) < 1 THEN
    RETURN operations;
  END IF;
  RETURN jsonb_build_object('operations', operations, 'data_epoch', epoch);
END;
$$;

ALTER FUNCTION pull_sync_operations(BIGINT, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_operations(BIGINT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pull_sync_operations(BIGINT, INT) TO authenticated;

-- pull_sync_snapshot ----------------------------------------------------------

ALTER FUNCTION pull_sync_snapshot() RENAME TO pull_sync_snapshot_ungated;
REVOKE ALL ON FUNCTION pull_sync_snapshot_ungated() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION pull_sync_snapshot_existing() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION pull_sync_snapshot(p_client_protocol INT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  epoch INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  epoch := sync_release_gate(p_client_protocol);
  RETURN pull_sync_snapshot_ungated() || jsonb_build_object('data_epoch', epoch);
END;
$$;

ALTER FUNCTION pull_sync_snapshot(INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION pull_sync_snapshot(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pull_sync_snapshot(INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
