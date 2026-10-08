-- Replays 20261008210000_baseline_cleanup.sql on seeded legacy rows inside a
-- transaction that rolls back. Run against a database at the migration before
-- it (e.g. a staging restore of the production backup):
--
--   psql "$DB_URL" -f supabase/tests/a8b-rehearsal.sql
--
-- Paths are relative to the repo root. Nothing is kept.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email, aud, role) VALUES ('11111111-2222-3333-4444-555555555555', 'a8b@test', 'authenticated', 'authenticated');
\set u '''11111111-2222-3333-4444-555555555555'''
INSERT INTO activity_groups (id, user_id, name, emoji, is_archived, created_at, updated_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', :u, 'G', '🌱', true, now(), now());
INSERT INTO activities (id, user_id, group_id, name, routine, is_archived, completed_at, archived_at, created_at, updated_at) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000002', :u, 'aaaaaaaa-0000-0000-0000-000000000001', 'A', 'daily', true, '2026-05-01', '2026-05-01', now(), now());
-- legacy random ids, one live, one tombstoned, plus one already natural
INSERT INTO daily_entries (id, user_id, date, task_counts, current_activity_id, created_at, updated_at) VALUES
  ('dddddddd-0000-0000-0000-000000000001', :u, '2026-01-01', '{"aaaaaaaa-0000-0000-0000-000000000002":2}', 'aaaaaaaa-0000-0000-0000-000000000002', now(), now()),
  (extensions.uuid_generate_v5('7e1b4c3a-9f20-4d8e-8c11-a1b2c3d4e5f6', 'daily:11111111-2222-3333-4444-555555555555:2026-01-02'), :u, '2026-01-02', '{}', NULL, now(), now());
INSERT INTO journal_entries (id, user_id, entry_date, text_content, is_journal_complete, journal_entry_number, deleted_at, created_at, updated_at) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', :u, '2026-01-01', 'kept text', true, 7, NULL, now(), now()),
  ('eeeeeeee-0000-0000-0000-000000000002', :u, '2026-01-03', 'tombstoned', false, 8, now(), now(), now());
INSERT INTO activity_periods (id, user_id, activity_id, daily_entry_id, start_time, end_time, created_at, updated_at) VALUES
  ('ffffffff-0000-0000-0000-000000000001', :u, 'aaaaaaaa-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', '2026-01-01T10:00Z', '2026-01-01T11:00Z', now(), now());
INSERT INTO one_time_tasks (id, user_id, title, date, group_id, created_at, updated_at) VALUES ('99999999-0000-0000-0000-000000000001', :u, 'memo', '2026-01-01', 'aaaaaaaa-0000-0000-0000-000000000001', now(), now());
SELECT data_epoch AS epoch_before, min_client_protocol AS proto_before FROM app_config;

\i supabase/migrations/20261008210000_baseline_cleanup.sql

\echo '--- re-keyed rows (all ids natural, content kept)'
SELECT 'journal' t, entry_date, text_content, deleted_at IS NOT NULL deleted,
  id = extensions.uuid_generate_v5('7e1b4c3a-9f20-4d8e-8c11-a1b2c3d4e5f6', 'journal:'||user_id||':'||entry_date) natural
FROM journal_entries WHERE user_id = :u
UNION ALL SELECT 'daily', date, task_counts::text, deleted_at IS NOT NULL,
  id = extensions.uuid_generate_v5('7e1b4c3a-9f20-4d8e-8c11-a1b2c3d4e5f6', 'daily:'||user_id||':'||date)
FROM daily_entries WHERE user_id = :u ORDER BY 1, 2;
\echo '--- id map'
SELECT table_name, old_id FROM legacy_a8_rekeyed_ids WHERE user_id = :u ORDER BY 1, 2;
\echo '--- dropped values kept'
SELECT table_name, dropped FROM legacy_a8_dropped_values WHERE user_id = :u ORDER BY 1;
\echo '--- session survives without day link'
SELECT id, activity_id, start_time FROM activity_periods WHERE user_id = :u;
\echo '--- gates'
SELECT data_epoch, min_client_protocol FROM app_config;
\echo '--- no function body still names a dropped column'
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND prosrc ~ '(current_activity_id|is_journal_complete|journal_completed_at|journal_entry_number|journal_completion_streak|recurring_memo_id)'
  AND proname NOT LIKE '%before_cutover%';

\echo '--- old-id ops after the window (through the gated public RPC)'
SELECT set_config('request.jwt.claims', '{"sub":"11111111-2222-3333-4444-555555555555","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT submit_sync_operations(jsonb_build_array(
  jsonb_build_object('operation_id', gen_random_uuid(), 'device_id', 'd1', 'entity_type', 'journal_entry',
    'entity_id', 'eeeeeeee-0000-0000-0000-000000000001', 'operation_type', 'projection.upsert',
    'payload', jsonb_build_object('row', jsonb_build_object('id', 'eeeeeeee-0000-0000-0000-000000000001',
      'entry_date', '2026-01-01', 'text_content', 'edited offline', 'updated_at', now()::text)))
), 3) AS upsert_result;
SELECT submit_sync_operations(jsonb_build_array(
  jsonb_build_object('operation_id', gen_random_uuid(), 'device_id', 'd1', 'entity_type', 'journal_entry',
    'entity_id', 'eeeeeeee-0000-0000-0000-000000000001', 'operation_type', 'projection.upsert',
    'payload', jsonb_build_object('row', jsonb_build_object('id', 'eeeeeeee-0000-0000-0000-000000000001',
      'entry_date', '2026-01-01', 'text_content', 'edited offline', 'deleted_at', now()::text, 'updated_at', now()::text)))
), 3) AS delete_result;
RESET ROLE;
SELECT count(*) AS journal_rows_for_date, bool_and(deleted_at IS NOT NULL) AS deleted,
  bool_and(id = extensions.uuid_generate_v5('7e1b4c3a-9f20-4d8e-8c11-a1b2c3d4e5f6', 'journal:11111111-2222-3333-4444-555555555555:2026-01-01')) AS natural
FROM journal_entries WHERE user_id = :u AND entry_date = '2026-01-01';
SELECT entity_id = extensions.uuid_generate_v5('7e1b4c3a-9f20-4d8e-8c11-a1b2c3d4e5f6', 'journal:11111111-2222-3333-4444-555555555555:2026-01-01') AS logged_natural,
  payload->'row'->>'id' = entity_id::text AS row_id_matches
FROM sync_operations WHERE user_id = :u;
\echo '--- second run is a no-op'
\i supabase/migrations/20261008210000_baseline_cleanup.sql
SELECT count(*) AS map_rows FROM legacy_a8_rekeyed_ids WHERE user_id = :u;
\echo '--- protocol-2 client is turned away'
SET LOCAL ROLE authenticated;
SELECT submit_sync_operations('[]'::jsonb, 2) AS old_client;
ROLLBACK;
