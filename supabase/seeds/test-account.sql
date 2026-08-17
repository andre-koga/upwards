-- Product data for test@test.com (auth user is created in ../seed.sql).
-- Dates are relative to CURRENT_DATE so streaks stay current after every reset.
-- Projection rows cover first-pull LWW; sync_operations (device_id = 'seed')
-- cover later ops-mode pulls. daily_entries are LWW-only — no count.delta ops.

DO $$
DECLARE
  v_user_id uuid;
  v_created_at timestamptz := (CURRENT_DATE - 50) + TIME '12:00';
  v_change_at timestamptz := (CURRENT_DATE - 20) + TIME '12:00';
  v_completed_at timestamptz := (CURRENT_DATE - 14) + TIME '12:00';
  v_archived_at timestamptz := (CURRENT_DATE - 10) + TIME '12:00';

  g_health uuid := '00000000-0000-4000-8000-000000000001';
  g_work   uuid := '00000000-0000-4000-8000-000000000002';
  g_home   uuid := '00000000-0000-4000-8000-000000000003';
  g_old    uuid := '00000000-0000-4000-8000-000000000004';

  gv_health uuid := '00000000-0000-4000-8001-000000000001';
  gv_work   uuid := '00000000-0000-4000-8001-000000000002';
  gv_home   uuid := '00000000-0000-4000-8001-000000000003';
  gv_old    uuid := '00000000-0000-4000-8001-000000000004';

  a_stretch uuid := '00000000-0000-4000-8010-000000000001';
  a_water   uuid := '00000000-0000-4000-8010-000000000002';
  a_gym     uuid := '00000000-0000-4000-8010-000000000003';
  a_hike    uuid := '00000000-0000-4000-8010-000000000004';
  a_default uuid := '00000000-0000-4000-8010-000000000005';
  a_inbox   uuid := '00000000-0000-4000-8010-000000000006';
  a_standup uuid := '00000000-0000-4000-8010-000000000007';
  a_deep    uuid := '00000000-0000-4000-8010-000000000008';
  a_cook    uuid := '00000000-0000-4000-8010-000000000009';
  a_rent    uuid := '00000000-0000-4000-8010-00000000000a';
  a_book    uuid := '00000000-0000-4000-8010-00000000000b';

  av_stretch uuid := '00000000-0000-4000-8011-000000000001';
  av_water   uuid := '00000000-0000-4000-8011-000000000002';
  av_gym     uuid := '00000000-0000-4000-8011-000000000003';
  av_hike    uuid := '00000000-0000-4000-8011-000000000004';
  av_default uuid := '00000000-0000-4000-8011-000000000005';
  av_inbox   uuid := '00000000-0000-4000-8011-000000000006';
  av_standup uuid := '00000000-0000-4000-8011-000000000007';
  av_deep_v1 uuid := '00000000-0000-4000-8011-000000000008';
  av_deep_v2 uuid := '00000000-0000-4000-8011-000000000108';
  av_cook    uuid := '00000000-0000-4000-8011-000000000009';
  av_rent    uuid := '00000000-0000-4000-8011-00000000000a';
  av_book    uuid := '00000000-0000-4000-8011-00000000000b';

  rm_daily  uuid := '00000000-0000-4000-8041-000000000001';
  rm_weekly uuid := '00000000-0000-4000-8041-000000000002';

  n int;
  d date;
  d_text text;
  dow int;
  is_break boolean;
  counts jsonb;
  paused jsonb;
  entry_id uuid;
  entry_ts timestamptz;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'test@test.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'test@test.com must be created by seed.sql first';
  END IF;

  -- ── Groups ────────────────────────────────────────────────────────────────
  INSERT INTO activity_groups (
    id, user_id, name, emoji, color, order_index, is_archived,
    created_at, updated_at, deleted_at
  ) VALUES
    (g_health, v_user_id, 'Health', NULL, '#22c55e', 0, false, v_created_at, v_created_at, NULL),
    (g_work,   v_user_id, 'Work',   NULL, '#3b82f6', 1, false, v_created_at, v_created_at, NULL),
    (g_home,   v_user_id, 'Home',   NULL, '#f59e0b', 2, false, v_created_at, v_created_at, NULL),
    (g_old,    v_user_id, 'Old project', NULL, '#6b7280', 3, true, v_created_at, v_archived_at, NULL);

  -- ── Activities ────────────────────────────────────────────────────────────
  INSERT INTO activities (
    id, user_id, group_id, name, routine, completion_target, completed_at,
    order_index, created_at, updated_at, deleted_at
  ) VALUES
    (a_stretch, v_user_id, g_health, 'Morning stretch', 'daily', 1, NULL, 0, v_created_at, v_created_at, NULL),
    (a_water,   v_user_id, g_health, 'Water', 'daily', 8, NULL, 1, v_created_at, v_created_at, NULL),
    (a_gym,     v_user_id, g_health, 'Gym', 'weekly:1,2,3,4,5', 1, NULL, 2, v_created_at, v_created_at, NULL),
    (a_hike,    v_user_id, g_health, 'Weekend hike', 'weekly:0,6', 1, NULL, 3, v_created_at, v_created_at, NULL),
    (a_default, v_user_id, g_health, NULL, NULL, 1, NULL, NULL, v_created_at, v_created_at, NULL),
    (a_inbox,   v_user_id, g_work, 'Inbox', 'anytime', 1, NULL, 0, v_created_at, v_created_at, NULL),
    (a_standup, v_user_id, g_work, 'Don''t skip standup', 'never', 1, NULL, 1, v_created_at, v_created_at, NULL),
    (a_deep,    v_user_id, g_work, 'Deep work', 'daily', 1, NULL, 2, v_created_at, v_change_at, NULL),
    (a_cook,    v_user_id, g_home, 'Cook dinner', 'custom:2:days', 1, NULL, 0, v_created_at, v_created_at, NULL),
    (a_rent,    v_user_id, g_home, 'Pay rent', 'monthly:1', 1, NULL, 1, v_created_at, v_created_at, NULL),
    (a_book,    v_user_id, g_home, 'Book club', 'daily', 1, v_completed_at, 2, v_created_at, v_completed_at, NULL);

  -- ── Definition versions ───────────────────────────────────────────────────
  INSERT INTO group_definition_versions (
    id, user_id, group_id, parent_version_id, effective_from, recorded_at,
    operation_id, device_id, name, color, order_index, schema_version,
    created_at, deleted_at
  ) VALUES
    (gv_health, v_user_id, g_health, NULL, (CURRENT_DATE - 50), v_created_at, gv_health, 'seed', 'Health', '#22c55e', 0, 1, v_created_at, NULL),
    (gv_work,   v_user_id, g_work,   NULL, (CURRENT_DATE - 50), v_created_at, gv_work,   'seed', 'Work',   '#3b82f6', 1, 1, v_created_at, NULL),
    (gv_home,   v_user_id, g_home,   NULL, (CURRENT_DATE - 50), v_created_at, gv_home,   'seed', 'Home',   '#f59e0b', 2, 1, v_created_at, NULL),
    (gv_old,    v_user_id, g_old,    NULL, (CURRENT_DATE - 50), v_created_at, gv_old,    'seed', 'Old project', '#6b7280', 3, 1, v_created_at, NULL);

  INSERT INTO activity_definition_versions (
    id, user_id, activity_id, parent_version_id, effective_from, recorded_at,
    operation_id, device_id, name, routine, completion_target, group_id,
    order_index, schema_version, created_at, deleted_at
  ) VALUES
    (av_stretch, v_user_id, a_stretch, NULL, (CURRENT_DATE - 50), v_created_at, av_stretch, 'seed', 'Morning stretch', 'daily', 1, g_health, 0, 1, v_created_at, NULL),
    (av_water,   v_user_id, a_water,   NULL, (CURRENT_DATE - 50), v_created_at, av_water,   'seed', 'Water', 'daily', 8, g_health, 1, 1, v_created_at, NULL),
    (av_gym,     v_user_id, a_gym,     NULL, (CURRENT_DATE - 50), v_created_at, av_gym,     'seed', 'Gym', 'weekly:1,2,3,4,5', 1, g_health, 2, 1, v_created_at, NULL),
    (av_hike,    v_user_id, a_hike,    NULL, (CURRENT_DATE - 50), v_created_at, av_hike,    'seed', 'Weekend hike', 'weekly:0,6', 1, g_health, 3, 1, v_created_at, NULL),
    (av_default, v_user_id, a_default, NULL, (CURRENT_DATE - 50), v_created_at, av_default, 'seed', NULL, NULL, 1, g_health, NULL, 1, v_created_at, NULL),
    (av_inbox,   v_user_id, a_inbox,   NULL, (CURRENT_DATE - 50), v_created_at, av_inbox,   'seed', 'Inbox', 'anytime', 1, g_work, 0, 1, v_created_at, NULL),
    (av_standup, v_user_id, a_standup, NULL, (CURRENT_DATE - 50), v_created_at, av_standup, 'seed', 'Don''t skip standup', 'never', 1, g_work, 1, 1, v_created_at, NULL),
    (av_deep_v1, v_user_id, a_deep,    NULL, (CURRENT_DATE - 50), v_created_at, av_deep_v1, 'seed', 'Deep work', 'weekly:1,2,3,4,5', 1, g_work, 2, 1, v_created_at, NULL),
    (av_deep_v2, v_user_id, a_deep,    av_deep_v1, (CURRENT_DATE - 20), v_change_at, av_deep_v2, 'seed', 'Deep work', 'daily', 1, g_work, 2, 1, v_change_at, NULL),
    (av_cook,    v_user_id, a_cook,    NULL, (CURRENT_DATE - 50), v_created_at, av_cook,    'seed', 'Cook dinner', 'custom:2:days', 1, g_home, 0, 1, v_created_at, NULL),
    (av_rent,    v_user_id, a_rent,    NULL, (CURRENT_DATE - 50), v_created_at, av_rent,    'seed', 'Pay rent', 'monthly:1', 1, g_home, 1, 1, v_created_at, NULL),
    (av_book,    v_user_id, a_book,    NULL, (CURRENT_DATE - 50), v_created_at, av_book,    'seed', 'Book club', 'daily', 1, g_home, 2, 1, v_created_at, NULL);

  -- ── Daily entries (today incomplete; ~45 days of mixed history) ───────────
  FOR n IN 0..44 LOOP
    d := CURRENT_DATE - n;
    d_text := to_char(d, 'YYYY-MM-DD');
    dow := EXTRACT(DOW FROM d)::int;
    is_break := n IN (12, 13);
    counts := '{}'::jsonb;
    paused := '[]'::jsonb;
    entry_id := ('00000000-0000-4000-8020-' || lpad(n::text, 12, '0'))::uuid;
    entry_ts := d + TIME '12:00';

    IF NOT is_break THEN
      IF n <> 0 AND n NOT IN (8, 21, 33) THEN
        counts := counts || jsonb_build_object(a_stretch::text, 1);
      END IF;

      IF n <> 0 THEN
        counts := counts || jsonb_build_object(a_water::text, 5 + (n % 4));
      END IF;

      IF n IN (5, 6, 7) THEN
        paused := jsonb_build_array(a_gym::text);
      ELSIF n <> 0 AND dow BETWEEN 1 AND 5 THEN
        counts := counts || jsonb_build_object(a_gym::text, 1);
      END IF;

      IF n <> 0 AND dow IN (0, 6) THEN
        counts := counts || jsonb_build_object(a_hike::text, 1);
      END IF;

      IF n % 7 = 2 THEN
        counts := counts || jsonb_build_object(a_inbox::text, 1);
      END IF;

      IF n IN (4, 18) THEN
        counts := counts || jsonb_build_object(a_standup::text, 1);
      END IF;

      IF n <> 0 AND n <= 20 THEN
        counts := counts || jsonb_build_object(a_deep::text, 1);
      ELSIF n > 20 AND dow BETWEEN 1 AND 5 THEN
        counts := counts || jsonb_build_object(a_deep::text, 1);
      END IF;

      IF n <> 0 AND (50 - n) % 2 = 0 THEN
        counts := counts || jsonb_build_object(a_cook::text, 1);
      END IF;

      IF EXTRACT(DAY FROM d) = 1 THEN
        counts := counts || jsonb_build_object(a_rent::text, 1);
      END IF;

      IF n > 14 THEN
        counts := counts || jsonb_build_object(a_book::text, 1);
      END IF;
    END IF;

    INSERT INTO daily_entries (
      id, user_id, date, task_counts, paused_task_ids, is_break_day,
      current_activity_id, created_at, updated_at, deleted_at
    ) VALUES (
      entry_id, v_user_id, d_text, counts, paused, is_break,
      NULL, entry_ts, entry_ts, NULL
    );
  END LOOP;

  -- ── Closed timer periods on recent days ───────────────────────────────────
  INSERT INTO activity_periods (
    id, user_id, daily_entry_id, activity_id, start_time, end_time,
    created_at, updated_at, deleted_at
  )
  SELECT
    ('00000000-0000-4000-8030-' || lpad(ord::text, 12, '0'))::uuid,
    v_user_id,
    ('00000000-0000-4000-8020-' || lpad(days_ago::text, 12, '0'))::uuid,
    activity_id,
    (CURRENT_DATE - days_ago) + start_at,
    (CURRENT_DATE - days_ago) + end_at,
    (CURRENT_DATE - days_ago) + start_at,
    (CURRENT_DATE - days_ago) + end_at,
    NULL
  FROM (VALUES
    (1,  1, a_stretch, TIME '07:10', TIME '07:25'),
    (2,  1, a_deep,    TIME '09:00', TIME '10:30'),
    (3,  2, a_gym,     TIME '18:00', TIME '19:05'),
    (4,  2, a_stretch, TIME '07:05', TIME '07:20'),
    (5,  3, a_deep,    TIME '09:15', TIME '11:00'),
    (6,  4, a_stretch, TIME '07:00', TIME '07:18'),
    (7,  8, a_hike,    TIME '08:00', TIME '10:40'),
    (8,  9, a_gym,     TIME '17:30', TIME '18:40'),
    (9,  9, a_deep,    TIME '09:00', TIME '10:00'),
    (10, 11, a_stretch, TIME '07:12', TIME '07:28')
  ) AS p(ord, days_ago, activity_id, start_at, end_at);

  -- ── Recurring memos + one-time memos ──────────────────────────────────────
  INSERT INTO recurring_memos (
    id, user_id, title, routine, is_pinned, is_enabled,
    created_at, updated_at, deleted_at
  ) VALUES
    (rm_daily,  v_user_id, 'Daily standup notes', 'daily', false, true, v_created_at, v_created_at, NULL),
    (rm_weekly, v_user_id, 'Weekly review', 'weekly:5', true, true, v_created_at, v_created_at, NULL);

  INSERT INTO one_time_tasks (
    id, user_id, date, title, is_completed, order_index, is_pinned, due_date,
    group_id, is_archived, recurring_memo_id, created_at, updated_at, deleted_at
  ) VALUES
    ('00000000-0000-4000-8040-000000000001', v_user_id, NULL, 'Buy oat milk', false, 0, true, NULL, NULL, false, NULL, v_created_at, v_created_at, NULL),
    ('00000000-0000-4000-8040-000000000002', v_user_id, NULL, 'Call dentist', false, 1, false, to_char(CURRENT_DATE, 'YYYY-MM-DD'), NULL, false, NULL, v_created_at, v_created_at, NULL),
    ('00000000-0000-4000-8040-000000000003', v_user_id, NULL, 'Return library books', false, 2, false, NULL, NULL, false, NULL, v_created_at, v_created_at, NULL),
    ('00000000-0000-4000-8040-000000000004', v_user_id, to_char(CURRENT_DATE - 1, 'YYYY-MM-DD'), 'Email landlord', true, 3, false, to_char(CURRENT_DATE - 1, 'YYYY-MM-DD'), NULL, false, NULL, v_created_at, (CURRENT_DATE - 1) + TIME '16:00', NULL),
    ('00000000-0000-4000-8040-000000000005', v_user_id, NULL, 'Old shopping list', false, 4, false, NULL, NULL, true, NULL, v_created_at, v_created_at, NULL),
    ('00000000-0000-4000-8040-000000000006', v_user_id, NULL, 'Daily standup notes', false, 5, false, to_char(CURRENT_DATE, 'YYYY-MM-DD'), NULL, false, rm_daily, v_created_at, now(), NULL);

  -- ── Journal (15 days, no media) ───────────────────────────────────────────
  INSERT INTO journal_entries (
    id, user_id, entry_date, title, text_content, day_emoji, is_bookmarked,
    is_journal_complete, journal_entry_number, journal_completion_streak,
    journal_completed_at, location, created_at, updated_at, deleted_at
  )
  SELECT
    ('00000000-0000-4000-8050-' || lpad(days_ago::text, 12, '0'))::uuid,
    v_user_id,
    to_char(CURRENT_DATE - days_ago, 'YYYY-MM-DD'),
    title,
    body,
    emoji,
    bookmarked,
    complete,
    CASE WHEN complete THEN dense_rank() OVER (
      PARTITION BY complete ORDER BY days_ago DESC
    ) END,
    streak,
    CASE WHEN complete THEN (CURRENT_DATE - days_ago) + TIME '21:30' END,
    loc,
    (CURRENT_DATE - days_ago) + TIME '21:00',
    (CURRENT_DATE - days_ago) + TIME '21:30',
    NULL
  FROM (VALUES
    (1,  'Quiet evening', 'Walked after dinner and stretched.', '😌', true, true, 3,
      '{"locations":[{"displayName":"Austin, TX","city":"Austin","state":"Texas","country":"United States","countryCode":"US","lat":30.2672,"lon":-97.7431}]}'::jsonb),
    (2,  'Deep work day', 'Two focused blocks before lunch.', '🧠', true, false, 2, NULL),
    (3,  'Easy Friday', 'Gym and an early night.', '😴', true, false, 1, NULL),
    (7,  'Draft only', 'Started writing and left it unfinished.', '✏️', false, false, NULL, NULL),
    (10, 'Long walk', 'Along the river until sunset.', '🚶', true, true, 2,
      '{"locations":[{"displayName":"Lady Bird Lake","city":"Austin","state":"Texas","country":"United States","countryCode":"US","lat":30.265,"lon":-97.753}]}'::jsonb),
    (11, 'Catch-up', 'Cleared the inbox pile.', '✅', true, false, 1, NULL),
    (14, 'Book club last meeting', 'Finished the novel and closed the habit.', '📚', true, true, 1, NULL),
    (18, 'Rainy day', 'Cooked soup and stayed in.', '🌧️', true, false, 1, NULL),
    (21, 'Notes', 'A few lines, not a full entry.', '📝', false, false, NULL, NULL),
    (24, 'Weekend reset', 'Hike in the morning, chores after.', '🌲', true, false, 3, NULL),
    (25, 'Friends over', 'Dinner at home.', '🍝', true, false, 2, NULL),
    (26, 'Market morning', 'Farmers market then coffee.', '☕', true, false, 1,
      '{"locations":[{"displayName":"Downtown Austin","city":"Austin","state":"Texas","country":"United States","countryCode":"US","lat":30.2711,"lon":-97.7437}]}'::jsonb),
    (32, 'Travel day', 'Trains and a late arrival.', '🚆', true, false, 1,
      '{"locations":[{"displayName":"Chicago, IL","city":"Chicago","state":"Illinois","country":"United States","countryCode":"US","lat":41.8781,"lon":-87.6298}]}'::jsonb),
    (38, 'Ordinary Tuesday', 'Stretch, water, deep work. Nothing fancy.', '🙂', true, false, 1, NULL),
    (42, 'Starting point', 'First week back into the routine.', '🌱', true, false, 1, NULL)
  ) AS j(days_ago, title, body, emoji, complete, bookmarked, streak, loc);

  -- ── Status events ─────────────────────────────────────────────────────────
  INSERT INTO activity_status_events (
    id, user_id, entity_id, status_type, next_value, effective_at,
    created_at, updated_at, deleted_at
  ) VALUES (
    '00000000-0000-4000-8060-000000000001',
    v_user_id, a_book, 'completed', true,
    (CURRENT_DATE - 13) + TIME '00:00',
    v_completed_at, v_completed_at, NULL
  );

  INSERT INTO group_status_events (
    id, user_id, entity_id, status_type, next_value, effective_at,
    created_at, updated_at, deleted_at
  ) VALUES (
    '00000000-0000-4000-8060-000000000002',
    v_user_id, g_old, 'archived', true,
    (CURRENT_DATE - 9) + TIME '00:00',
    v_archived_at, v_archived_at, NULL
  );

  -- ── sync_operations (device_id = seed so the client always applies them) ──
  INSERT INTO sync_operations (
    user_id, operation_id, device_id, entity_type, entity_id,
    operation_type, payload, base_revision, status
  )
  SELECT v_user_id, operation_id, 'seed', entity_type, entity_id,
         operation_type, payload, NULL, 'accepted'
  FROM (
    -- Groups first so later activity rows have a parent locally.
    SELECT 10 AS ord, id AS operation_id, 'activity_group'::text AS entity_type, id AS entity_id,
           'projection.upsert'::text AS operation_type,
           jsonb_build_object('row', to_jsonb(g) - 'server_updated_at') AS payload
    FROM activity_groups g WHERE g.user_id = v_user_id

    UNION ALL
    SELECT 20, gv.id, 'group_definition', gv.group_id, 'definition.create',
           jsonb_build_object(
             'version_id', gv.id,
             'parent_version_id', NULL,
             'effective_from', gv.effective_from,
             'recorded_at', gv.recorded_at,
             'schema_version', 1,
             'fields', jsonb_build_object(
               'name', gv.name,
               'color', gv.color,
               'order_index', gv.order_index
             )
           )
    FROM group_definition_versions gv WHERE gv.user_id = v_user_id

    UNION ALL
    SELECT 30, a.id, 'activity', a.id, 'projection.upsert',
           jsonb_build_object('row', to_jsonb(a) - 'server_updated_at')
    FROM activities a WHERE a.user_id = v_user_id

    UNION ALL
    SELECT
      CASE WHEN adv.parent_version_id IS NULL THEN 40 ELSE 41 END,
      adv.id,
      'activity_definition',
      adv.activity_id,
      CASE WHEN adv.parent_version_id IS NULL THEN 'definition.create' ELSE 'definition.update' END,
      jsonb_strip_nulls(jsonb_build_object(
        'version_id', adv.id,
        'parent_version_id', adv.parent_version_id,
        'effective_from', adv.effective_from,
        'recorded_at', adv.recorded_at,
        'schema_version', 1,
        'fields', jsonb_strip_nulls(jsonb_build_object(
          'name', adv.name,
          'routine', adv.routine,
          'completion_target', adv.completion_target,
          'group_id', adv.group_id,
          'order_index', adv.order_index
        ))
      ))
    FROM activity_definition_versions adv WHERE adv.user_id = v_user_id

    UNION ALL
    SELECT 50, rm.id, 'recurring_memo', rm.id, 'projection.upsert',
           jsonb_build_object('row', to_jsonb(rm) - 'server_updated_at')
    FROM recurring_memos rm WHERE rm.user_id = v_user_id

    UNION ALL
    SELECT 60, t.id, 'one_time_task', t.id, 'projection.upsert',
           jsonb_build_object('row', to_jsonb(t) - 'server_updated_at')
    FROM one_time_tasks t WHERE t.user_id = v_user_id

    UNION ALL
    SELECT 70, je.id, 'journal_entry', je.id, 'projection.upsert',
           jsonb_build_object('row', to_jsonb(je) - 'server_updated_at')
    FROM journal_entries je WHERE je.user_id = v_user_id

    UNION ALL
    SELECT 80, ap.id, 'activity_period', ap.id, 'projection.upsert',
           jsonb_build_object('row', to_jsonb(ap) - 'server_updated_at')
    FROM activity_periods ap WHERE ap.user_id = v_user_id

    UNION ALL
    SELECT 90, ase.id, 'activity_status_event', ase.id, 'projection.upsert',
           jsonb_build_object('row', to_jsonb(ase) - 'server_updated_at')
    FROM activity_status_events ase WHERE ase.user_id = v_user_id

    UNION ALL
    SELECT 91, gse.id, 'group_status_event', gse.id, 'projection.upsert',
           jsonb_build_object('row', to_jsonb(gse) - 'server_updated_at')
    FROM group_status_events gse WHERE gse.user_id = v_user_id
  ) ops
  ORDER BY ord, operation_id;

  UPDATE activity_definition_versions adv
  SET server_sequence = so.server_sequence
  FROM sync_operations so
  WHERE adv.user_id = v_user_id
    AND so.user_id = v_user_id
    AND so.operation_id = adv.operation_id;

  UPDATE group_definition_versions gdv
  SET server_sequence = so.server_sequence
  FROM sync_operations so
  WHERE gdv.user_id = v_user_id
    AND so.user_id = v_user_id
    AND so.operation_id = gdv.operation_id;
END $$;
