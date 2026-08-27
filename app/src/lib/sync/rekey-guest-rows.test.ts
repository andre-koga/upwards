import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Natural IDs are derived from `guest:<deviceId>` before sign-in and `userId`
 * after, so every row a guest wrote carries an id no signed-in device recomputes.
 * The `upload_local` handoff pushed them unchanged, so the next time the user
 * touched that date while signed in a *second* row appeared under the canonical id
 * — the source of the duplicate (user, date) rows journal dedupe then had to
 * destroy content to resolve.
 */

const { tables } = vi.hoisted(() => ({
  tables: {
    journalEntries: [] as Array<Record<string, unknown>>,
    dailyEntries: [] as Array<Record<string, unknown>>,
    activityPeriods: [] as Array<Record<string, unknown>>,
  },
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
});

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  getCachedUserId: () => "user-1",
}));

function tableApi(rows: Array<Record<string, unknown>>) {
  return {
    toArray: async () => [...rows],
    get: async (id: string) => rows.find((r) => r.id === id),
    add: async (row: Record<string, unknown>) => {
      rows.push(row);
    },
    put: async (row: Record<string, unknown>) => {
      const idx = rows.findIndex((r) => r.id === row.id);
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
    },
    update: async (id: string, patch: Record<string, unknown>) => {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
    },
    delete: async (id: string) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows.splice(idx, 1);
    },
    bulkDelete: async (ids: string[]) => {
      for (const id of ids) {
        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) rows.splice(idx, 1);
      }
    },
    where: () => ({
      equals: (value: string) => ({
        toArray: async () =>
          rows.filter((r) => r.daily_entry_id === value),
      }),
    }),
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    journalEntries: tableApi(tables.journalEntries),
    dailyEntries: tableApi(tables.dailyEntries),
    activityPeriods: tableApi(tables.activityPeriods),
  },
  now: () => "2026-08-27T00:00:00.000Z",
}));

vi.mock("./projection-sync", () => ({
  enqueueProjectionUpsertForTable: async () => {},
  withSuppressedProjectionEnqueue: async (fn: () => Promise<void>) => fn(),
  OPS_MANAGED_SYNC_TABLES: [],
}));

vi.mock("./unsynced-data", () => ({
  listPendingEntityIds: async () => new Set<string>(),
}));

const { rekeyLocalRowsToCurrentUser } = await import("./identity-repair");
const { naturalJournalId, naturalDailyEntryId } = await import("./natural-ids");

describe("rekeyLocalRowsToCurrentUser", () => {
  beforeEach(() => {
    storage.clear();
    for (const rows of Object.values(tables)) rows.length = 0;
  });

  it("re-keys a guest journal row onto the signed-in user's natural id", async () => {
    const guestId = naturalJournalId("guest:device-a", "2026-08-20");
    const canonicalId = naturalJournalId("user-1", "2026-08-20");
    expect(guestId).not.toBe(canonicalId);

    tables.journalEntries.push({
      id: guestId,
      entry_date: "2026-08-20",
      text_content: "written before signing in",
      title: null,
      day_emoji: null,
      video_path: null,
      video_thumbnail: null,
      photo_paths: null,
      location: null,
      is_bookmarked: null,
      is_journal_complete: null,
      journal_entry_number: null,
      journal_completion_streak: null,
      journal_completed_at: null,
      created_at: "2026-08-20T10:00:00.000Z",
      updated_at: "2026-08-20T10:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    });

    await rekeyLocalRowsToCurrentUser();

    const canonical = tables.journalEntries.find((r) => r.id === canonicalId);
    expect(canonical).toBeDefined();
    expect(canonical!.text_content).toBe("written before signing in");
    expect(canonical!.deleted_at).toBeNull();
  });

  it("re-keys a guest daily entry and carries its periods across", async () => {
    const guestId = naturalDailyEntryId("guest:device-a", "2026-08-20");
    const canonicalId = naturalDailyEntryId("user-1", "2026-08-20");

    tables.dailyEntries.push({
      id: guestId,
      date: "2026-08-20",
      task_counts: { "activity-1": 2 },
      updated_at: "2026-08-20T10:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    });
    tables.activityPeriods.push({
      id: "period-1",
      daily_entry_id: guestId,
      activity_id: "activity-1",
      start_time: "2026-08-20T10:00:00.000Z",
      end_time: "2026-08-20T11:00:00.000Z",
      updated_at: "2026-08-20T10:00:00.000Z",
    });

    await rekeyLocalRowsToCurrentUser();

    expect(tables.dailyEntries.find((r) => r.id === guestId)).toBeUndefined();
    const canonical = tables.dailyEntries.find((r) => r.id === canonicalId);
    expect(canonical).toBeDefined();
    expect(canonical!.task_counts).toEqual({ "activity-1": 2 });
    // A period left pointing at the old id would be orphaned off the timeline.
    expect(tables.activityPeriods[0]!.daily_entry_id).toBe(canonicalId);
  });

  it("runs even after the one-shot cutover flag is already set", async () => {
    // repairNaturalIdentity is flagged so it runs once per device, long before any
    // later sign-in. Sharing that flag would make this a no-op exactly when it is
    // needed.
    storage.set("okhabit_natural_identity_repaired_v1", "1");
    const guestId = naturalDailyEntryId("guest:device-a", "2026-08-21");

    tables.dailyEntries.push({
      id: guestId,
      date: "2026-08-21",
      task_counts: {},
      updated_at: "2026-08-21T10:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    });

    await rekeyLocalRowsToCurrentUser();

    expect(tables.dailyEntries.find((r) => r.id === guestId)).toBeUndefined();
  });

  it("is idempotent for rows already on the canonical id", async () => {
    const canonicalId = naturalDailyEntryId("user-1", "2026-08-22");
    tables.dailyEntries.push({
      id: canonicalId,
      date: "2026-08-22",
      task_counts: { "activity-1": 1 },
      updated_at: "2026-08-22T10:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    });

    await rekeyLocalRowsToCurrentUser();
    await rekeyLocalRowsToCurrentUser();

    expect(tables.dailyEntries).toHaveLength(1);
    expect(tables.dailyEntries[0]!.task_counts).toEqual({ "activity-1": 1 });
  });
});
