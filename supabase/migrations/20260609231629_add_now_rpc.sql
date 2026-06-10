-- Create RPC function to get current server time
-- Used by sync engine to capture server timestamp for delta-pull queries
CREATE OR REPLACE FUNCTION now()
RETURNS TIMESTAMPTZ AS $$
  SELECT now();
$$ LANGUAGE SQL STABLE;
