import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "44444444-4444-4444-8444-444444444444" as string | null,
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => auth.userId,
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-a",
}));
vi.mock("@/lib/sync", () => ({
  syncEngine: {
    getState: () => ({ updateRequired: false, lastError: null }),
    sync: async () => undefined,
    subscribe: () => () => undefined,
  },
}));
vi.mock("@/lib/i18n", () => ({ default: { changeLanguage: async () => {} } }));

import { db } from "@/lib/db";
import type {
  DailyEntry,
  JournalEntry,
  SyncPendingOperation,
} from "@/lib/db/types";
import { importBackup } from "@/lib/sync/mutate-synced";
import { resolveJournalConflict } from "@/lib/sync/journal-conflict-resolution";
import { naturalDailyEntryId, naturalJournalId } from "@/lib/sync/natural-ids";
import { buildBackupDocument } from "./export";
import {
  BACKUP_JSON_NAME,
  BACKUP_TABLE_NAMES,
  type BackupDocument,
  type BackupTables,
} from "./format";
import { remapBackupIdentity } from "./identity";
import { importBackupFile } from "./import";
import { migrateBackupDocument } from "./migrators";
import { ZipBlobWriter } from "./zip";

const USER = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";
const D1 = "2026-09-01";
const D2 = "2026-09-02";
const T0 = "2026-09-01T08:00:00.000Z";

function dayRow(
  userKey: string,
  date: string,
  patch: Partial<DailyEntry>
): DailyEntry {
  return {
    id: naturalDailyEntryId(userKey, date),
    date,
    task_counts: {},
    paused_task_ids: [],
    is_break_day: false,
    current_activity_id: null,
    completion_notes: {},
    completion_times: {},
    created_at: T0,
    updated_at: T0,
    synced_at: T0,
    deleted_at: null,
    ...patch,
  };
}

function journalRow(
  userKey: string,
  date: string,
  patch: Partial<JournalEntry>
): JournalEntry {
  return {
    id: naturalJournalId(userKey, date),
    entry_date: date,
    title: "Morning",
    text_content: "A good day",
    day_emoji: "🌿",
    is_bookmarked: false,
    video_path: null,
    video_thumbnail: null,
    photo_paths: [`${userKey}/${date}/a.jpg`],
    is_journal_complete: true,
    journal_entry_number: null,
    journal_completion_streak: null,
    journal_completed_at: null,
    location: null,
    created_at: T0,
    updated_at: T0,
    synced_at: T0,
    deleted_at: null,
    ...patch,
  };
}

async function clearAll() {
  for (const name of BACKUP_TABLE_NAMES) await db[name].clear();
  await db.syncPendingOperations.clear();
  await db.syncIssues.clear();
}

async function seed(userKey = USER) {
  const base = {
    created_at: T0,
    updated_at: T0,
    synced_at: T0,
    deleted_at: null,
  };
  await db.activityGroups.add({
    id: "g1",
    name: "Health",
    emoji: null,
    color: "green",
    order_index: 0,
    is_archived: false,
    ...base,
  });
  for (const id of ["a1", "a2"]) {
    await db.activities.add({
      id,
      group_id: "g1",
      name: id === "a1" ? "Run" : "Read",
      routine: "daily",
      completion_target: 3,
      is_archived: false,
      completed_at: null,
      order_index: 0,
      ...base,
    });
  }
  await db.dailyEntries.bulkAdd([
    dayRow(userKey, D1, {
      task_counts: { a1: 2 },
      paused_task_ids: ["a2"],
      completion_notes: { a1: "easy pace" },
      completion_times: { a1: "2026-09-01T07:30:00.000Z" },
    }),
    dayRow(userKey, D2, { task_counts: { a2: 1 }, is_break_day: true }),
  ]);
  await db.activityPeriods.add({
    id: "p1",
    daily_entry_id: naturalDailyEntryId(userKey, D1),
    activity_id: "a1",
    start_time: "2026-09-01T06:00:00.000Z",
    end_time: "2026-09-01T06:30:00.000Z",
    note: "hills",
    ...base,
  });
  await db.journalEntries.add(journalRow(userKey, D1, {}));
  await db.memories.add({
    id: "m1",
    text_content: "First bike",
    photo_paths: null,
    time_label: "when I was six",
    ...base,
  });
  await db.recurringMemos.add({
    id: "r1",
    title: "Water plants",
    routine: "weekly",
    is_pinned: false,
    is_enabled: true,
    ...base,
  });
  await db.oneTimeTasks.add({
    id: "t1",
    date: null,
    title: "Call mom",
    is_completed: false,
    order_index: 0,
    is_pinned: false,
    due_date: D2,
    group_id: null,
    is_archived: false,
    recurring_memo_id: "r1",
    ...base,
  });
  await db.activityStatusEvents.add({
    id: "e1",
    entity_id: "a2",
    status_type: "archived",
    next_value: false,
    effective_at: T0,
    ...base,
  });
  await db.groupStatusEvents.add({
    id: "ge1",
    entity_id: "g1",
    status_type: "archived",
    next_value: false,
    effective_at: T0,
    ...base,
  });
}

/** What a backup must preserve: content, not this device's sync bookkeeping. */
function comparable(tables: BackupTables) {
  const strip = (row: object) => {
    const copy = { ...(row as Record<string, unknown>) };
    delete copy.synced_at;
    return copy;
  };
  const isEmptyDay = (row: DailyEntry) =>
    Object.keys(row.task_counts ?? {}).length === 0 &&
    (row.paused_task_ids ?? []).length === 0 &&
    !row.is_break_day &&
    Object.keys(row.completion_notes ?? {}).length === 0;
  const out: Record<string, unknown[]> = {};
  for (const name of BACKUP_TABLE_NAMES) {
    let rows = tables[name] as unknown as object[];
    if (name === "dailyEntries") {
      rows = (rows as DailyEntry[])
        .filter((row) => !isEmptyDay(row))
        .map((row) => {
          const copy: Partial<DailyEntry> = { ...row };
          delete copy.created_at;
          delete copy.updated_at;
          return copy;
        });
    }
    out[name] = rows
      .map(strip)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return out;
}

async function exportDoc(): Promise<BackupDocument> {
  return JSON.parse(JSON.stringify(await buildBackupDocument()));
}

function runImport(file: unknown, userKey = USER, syncedSequence = 7) {
  const doc = remapBackupIdentity(migrateBackupDocument(file), userKey);
  return importBackup(doc.tables, { targetUserKey: userKey, syncedSequence });
}

async function pendingOps(): Promise<SyncPendingOperation[]> {
  return db.syncPendingOperations.orderBy("created_at").toArray();
}

describe("backup round trip", () => {
  beforeEach(async () => {
    auth.userId = USER;
    await clearAll();
  });

  it("export → clear → import restores the same data", async () => {
    await seed();
    const original = comparable((await exportDoc()).tables);
    const file = await exportDoc();

    await clearAll();
    const summary = await runImport(file);

    expect(comparable((await buildBackupDocument()).tables)).toEqual(original);
    expect(summary.countsAdded).toBe(3);
    expect(summary.journalConflicts).toBe(0);
  });

  it("importing the same file twice changes nothing the second time", async () => {
    await seed();
    const file = await exportDoc();
    await clearAll();
    await runImport(file);
    const afterFirst = await buildBackupDocument();
    const opsAfterFirst = await pendingOps();

    const second = await runImport(file);

    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.countsAdded).toBe(0);
    expect(await pendingOps()).toHaveLength(opsAfterFirst.length);
    expect((await buildBackupDocument()).tables).toEqual(afterFirst.tables);
  });

  it("merges into a non-empty account without double counting", async () => {
    await seed();
    const file = await exportDoc();
    // The account has moved on since the backup: more runs on D1's other
    // habit, fewer on D2, and a newer name for the habit.
    await db.dailyEntries.update(naturalDailyEntryId(USER, D1), {
      task_counts: { a1: 1 },
    });
    await db.dailyEntries.update(naturalDailyEntryId(USER, D2), {
      task_counts: { a2: 4 },
    });
    await db.activities.update("a1", {
      name: "Trail run",
      updated_at: "2026-09-05T00:00:00.000Z",
    });
    await db.syncPendingOperations.clear();
    const server = { [D1]: { a1: 1 }, [D2]: { a2: 4 } };

    const summary = await runImport(file);

    const d1 = await db.dailyEntries.get(naturalDailyEntryId(USER, D1));
    const d2 = await db.dailyEntries.get(naturalDailyEntryId(USER, D2));
    expect(d1?.task_counts).toEqual({ a1: 2 });
    expect(d2?.task_counts).toEqual({ a2: 4 });
    expect((await db.activities.get("a1"))?.name).toBe("Trail run");
    expect(summary.countsAdded).toBe(1);
    expect(summary.keptNewer).toBeGreaterThan(0);

    // The server folds the same deltas and must land on the same counts.
    const deltas = (await pendingOps()).filter(
      (op) => op.operation_type === "count.delta"
    );
    for (const op of deltas) {
      const p = op.payload as {
        date: string;
        activity_id: string;
        delta: number;
      };
      const counts = server[p.date as keyof typeof server] as Record<
        string,
        number
      >;
      counts[p.activity_id] = (counts[p.activity_id] ?? 0) + p.delta;
    }
    expect(server).toEqual({ [D1]: d1?.task_counts, [D2]: d2?.task_counts });
  });

  it("derives the same operation ids from the same synced state", async () => {
    await seed();
    const file = await exportDoc();
    await clearAll();
    await runImport(file);
    const firstIds = (await pendingOps()).map((op) => op.operation_id).sort();

    await clearAll();
    await runImport(file);
    const secondIds = (await pendingOps()).map((op) => op.operation_id).sort();

    expect(secondIds).toEqual(firstIds);
    expect(new Set(firstIds).size).toBe(firstIds.length);
  });

  it("turns different journal text into a reviewable conflict, once", async () => {
    await seed();
    const file = await exportDoc();
    const journalId = naturalJournalId(USER, D1);
    await db.journalEntries.update(journalId, {
      text_content: "Rewritten since the backup",
      updated_at: "2026-09-03T00:00:00.000Z",
    });

    const first = await runImport(file);
    const second = await runImport(file);

    expect(first.journalConflicts).toBe(1);
    expect(second.journalConflicts).toBe(0);
    expect((await db.journalEntries.get(journalId))?.text_content).toBe(
      "Rewritten since the backup"
    );
    const issues = await db.syncIssues.toArray();
    expect(issues).toHaveLength(1);
    expect(issues[0].payload).toMatchObject({
      kind: "journal_conflict",
      source: "backup",
    });

    await db.syncPendingOperations.clear();
    await resolveJournalConflict(issues[0], "keep_remote");
    expect((await db.journalEntries.get(journalId))?.text_content).toBe(
      "A good day"
    );
    const [op] = await pendingOps();
    expect(op.operation_type).toBe("projection.upsert");
    expect(op.base_revision).toBe("2026-09-03T00:00:00.000Z");
  });

  it("re-keys a backup from another account and stays idempotent", async () => {
    await seed();
    const file = await exportDoc();
    await clearAll();
    auth.userId = OTHER;

    await runImport(file, OTHER);
    const second = await runImport(file, OTHER);

    const activities = await db.activities.toArray();
    expect(activities).toHaveLength(2);
    expect(activities.map((a) => a.id)).not.toContain("a1");
    const run = activities.find((a) => a.name === "Run")!;
    const d1 = await db.dailyEntries.get(naturalDailyEntryId(OTHER, D1));
    expect(d1?.task_counts).toEqual({ [run.id]: 2 });
    const journal = await db.journalEntries.get(naturalJournalId(OTHER, D1));
    expect(journal?.photo_paths).toEqual([`${OTHER}/${D1}/a.jpg`]);
    expect(second.inserted + second.updated + second.countsAdded).toBe(0);
  });

  it("imports a data-only zip file end to end", async () => {
    await seed();
    const writer = new ZipBlobWriter();
    writer.addJson(BACKUP_JSON_NAME, await exportDoc());
    const zip = await writer.finish();
    await clearAll();

    const result = await importBackupFile(
      new File([zip], "upwards-backup.zip", { type: "application/zip" })
    );

    expect(result.kind).toBe("data");
    expect(await db.activities.count()).toBe(2);
    expect(
      (await db.dailyEntries.get(naturalDailyEntryId(USER, D2)))?.is_break_day
    ).toBe(true);
  });

  it("folds a legacy file's untimed periods into completion times", async () => {
    const legacy = {
      version: 4,
      exportedAt: T0,
      activityGroups: [],
      activities: [],
      dailyEntries: [{ id: "old-day", date: D1, task_counts: { a1: 1 } }],
      activityPeriods: [
        {
          id: "untimed",
          daily_entry_id: "old-day",
          activity_id: "a1",
          start_time: "2026-09-01T10:00:00.000Z",
          end_time: "2026-09-01T10:00:00.000Z",
        },
      ],
    };

    await runImport(legacy);

    expect(await db.activityPeriods.count()).toBe(0);
    const day = await db.dailyEntries.get(naturalDailyEntryId(USER, D1));
    expect(day?.task_counts).toEqual({ a1: 1 });
    expect(day?.completion_times).toEqual({ a1: "2026-09-01T10:00:00.000Z" });
  });
});
