-- SECURITY DEFINER sync RPCs must run as postgres to write projection tables under RLS.
ALTER FUNCTION submit_sync_operations(JSONB) OWNER TO postgres;
ALTER FUNCTION pull_sync_operations(BIGINT) OWNER TO postgres;

-- Local/CI stacks created from migrations need explicit grants for the
-- authenticated role (hosted Supabase projects usually inherit these).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Realtime INSERT payloads include user_id/device_id for cross-device wake.
ALTER TABLE sync_operations REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_operations;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;
