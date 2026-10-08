import { beforeAll, describe, expect, it } from "vitest";
import {
  createIsolatedUser,
  newId,
  projectionUpsertOp,
  pullSnapshot,
  submitOps,
  type IsolatedUser,
} from "./helpers";
import { sql } from "./sql";

// The schema and sync RPC after the A8b baseline cleanup
// (20261008210000_baseline_cleanup.sql). The re-key itself runs once, on the
// rows that exist when the migration applies; supabase/tests/a8b-rehearsal.sql
// replays it on seeded legacy rows.

const DROPPED: Record<string, string[]> = {
  activities: ["completed_at", "is_archived"],
  activity_groups: ["emoji", "is_archived"],
  activity_periods: ["daily_entry_id"],
  daily_entries: ["current_activity_id"],
  journal_entries: [
    "is_journal_complete",
    "journal_completed_at",
    "journal_entry_number",
    "journal_completion_streak",
  ],
  one_time_tasks: ["group_id", "recurring_memo_id"],
};

const lit = (value: string) => `'${value.replaceAll("'", "''")}'`;

describe("A8b baseline cleanup", () => {
  let user: IsolatedUser;
  const DEVICE = "a8b-device";

  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  it("dropped every dead column", () => {
    const rows = sql(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (${Object.entries(DROPPED)
        .map(
          ([table, cols]) =>
            `(table_name = ${lit(table)} AND column_name IN (${cols.map(lit).join(", ")}))`
        )
        .join(" OR ")});
    `);
    expect(rows).toEqual([]);
  });

  it("keeps no helper or trigger that named them", () => {
    const rows = sql(`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('cutover_a6_convert', 'activities_keep_archive_flags_in_sync', 'a8_natural_id');
    `);
    expect(rows).toEqual([]);
  });

  it("keeps the legacy tables away from the API roles", () => {
    const rows = sql(`
      SELECT table_name, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('legacy_a8_dropped_values', 'legacy_a8_rekeyed_ids')
        AND grantee IN ('anon', 'authenticated');
    `);
    expect(rows).toEqual([]);
  });

  it("accepts a current client's rows and leaves a stale client's extra fields out", async () => {
    const groupId = newId();
    const activityId = newId();
    const taskId = newId();
    const date = "2026-10-08";
    const ts = "2026-10-08T12:00:00.000Z";

    const results = await submitOps(user.deviceA, [
      projectionUpsertOp({
        deviceId: DEVICE,
        entityType: "activity_group",
        entityId: groupId,
        row: { name: "Health", emoji: "🌱", is_archived: false, created_at: ts, updated_at: ts },
      }),
      projectionUpsertOp({
        deviceId: DEVICE,
        entityType: "activity",
        entityId: activityId,
        row: {
          group_id: groupId,
          name: "Run",
          routine: "daily",
          is_archived: true,
          completed_at: ts,
          created_at: ts,
          updated_at: ts,
        },
      }),
      projectionUpsertOp({
        deviceId: DEVICE,
        entityType: "journal_entry",
        entityId: newId(),
        row: {
          entry_date: date,
          text_content: "after the window",
          is_journal_complete: true,
          journal_entry_number: 3,
          created_at: ts,
          updated_at: ts,
        },
      }),
      projectionUpsertOp({
        deviceId: DEVICE,
        entityType: "one_time_task",
        entityId: taskId,
        row: {
          title: "Call",
          date,
          group_id: groupId,
          recurring_memo_id: newId(),
          created_at: ts,
          updated_at: ts,
        },
      }),
    ]);
    expect(results.map((r) => r.status)).toEqual([
      "accepted",
      "accepted",
      "accepted",
      "accepted",
    ]);

    const snapshot = await pullSnapshot(user.deviceA);
    const activity = (snapshot.activities as Array<Record<string, unknown>>).find(
      (row) => row.id === activityId
    );
    expect(activity?.name).toBe("Run");
    // A legacy archive flag no longer archives anything: archived_at does.
    expect(activity?.archived_at).toBeNull();
    const journal = (snapshot.journal_entries as Array<Record<string, unknown>>).find(
      (row) => row.entry_date === date
    );
    expect(journal?.text_content).toBe("after the window");
    expect(journal).not.toHaveProperty("is_journal_complete");
    const task = (snapshot.one_time_tasks as Array<Record<string, unknown>>).find(
      (row) => row.id === taskId
    );
    expect(task?.title).toBe("Call");
    expect(task).not.toHaveProperty("group_id");
  });

  it("lands an offline journal delete queued under a re-keyed id on the natural row", async () => {
    // A device that queued an edit before the window still names the old id.
    // Journal deletes match by exact id, so without the translation this one
    // would be skipped and the entry would stay live on the server.
    const date = "2026-10-01";
    const oldId = newId();
    const ts = "2026-10-01T09:00:00.000Z";
    // The natural id the migration would have assigned, written as it would be.
    const [{ id: naturalId }] = sql(`
      SELECT extensions.uuid_generate_v5(
        '7e1b4c3a-9f20-4d8e-8c11-a1b2c3d4e5f6'::uuid,
        'journal:' || ${lit(user.userId)} || ':' || ${lit(date)}
      )::text AS id;
    `) as Array<{ id: string }>;
    sql(`
      INSERT INTO journal_entries (id, user_id, entry_date, text_content, created_at, updated_at)
      VALUES (${lit(naturalId)}, ${lit(user.userId)}, ${lit(date)}, 'old entry', ${lit(ts)}, ${lit(ts)});
    `);
    sql(`
      INSERT INTO legacy_a8_rekeyed_ids (table_name, old_id, new_id, user_id)
      VALUES ('journal_entries', ${lit(oldId)}, ${lit(naturalId)}, ${lit(user.userId)});
    `);

    const results = await submitOps(user.deviceA, [
      projectionUpsertOp({
        deviceId: DEVICE,
        entityType: "journal_entry",
        entityId: oldId,
        row: {
          id: oldId,
          entry_date: date,
          text_content: "old entry",
          deleted_at: "2026-10-02T09:00:00.000Z",
          updated_at: "2026-10-02T09:00:00.000Z",
        },
      }),
    ]);
    expect(results[0]?.status).toBe("accepted");

    const rows = sql(`
      SELECT id::text AS id, deleted_at IS NOT NULL AS deleted FROM journal_entries
      WHERE user_id = ${lit(user.userId)} AND entry_date = ${lit(date)};
    `);
    expect(rows).toEqual([{ id: naturalId, deleted: true }]);

    const logged = sql(`
      SELECT entity_id::text AS entity_id, payload->'row'->>'id' AS row_id
      FROM sync_operations
      WHERE user_id = ${lit(user.userId)} AND operation_id = ${lit(results[0]!.operation_id)};
    `);
    // Other devices apply the op by id, so it must carry the id they hold.
    expect(logged).toEqual([{ entity_id: naturalId, row_id: naturalId }]);
  });
});
