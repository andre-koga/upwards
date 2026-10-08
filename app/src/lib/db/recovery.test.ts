import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ configured: false }));
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  get isSupabaseConfigured() {
    return env.configured;
  },
  getCachedUserId: () => USER,
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-a",
}));

import { db, LOCAL_DB_NAME } from "@/lib/db";
import type { DailyEntry } from "@/lib/db/types";
import { remapBackupIdentity } from "@/lib/backup/identity";
import { migrateBackupDocument } from "@/lib/backup/migrators";
import { importBackup } from "@/lib/sync/mutate-synced";
import { naturalDailyEntryId } from "@/lib/sync/natural-ids";
import { loadRecoveryBundles, prepareLocalDatabase } from "./recovery";

const USER = "44444444-4444-4444-8444-444444444444";
const DAY = "2026-09-01";
const T0 = "2026-09-01T08:00:00.000Z";

/** The v26–v31 store layout, as an old build left it. */
const OLD_STORES = [
  "activityGroups",
  "activities",
  "dailyEntries",
  "activityPeriods",
  "journalEntries",
  "oneTimeTasks",
  "recurringMemos",
  "activityStatusEvents",
  "groupStatusEvents",
  "syncPendingOperations",
];

function seedRawDatabase(
  dexieVersion: number,
  rows: Record<string, unknown[]>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, dexieVersion * 10);
    req.onupgradeneeded = () => {
      for (const name of OLD_STORES) {
        req.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const idb = req.result;
      const tx = idb.transaction(OLD_STORES, "readwrite");
      for (const [name, list] of Object.entries(rows)) {
        for (const row of list) tx.objectStore(name).put(row);
      }
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function localDatabaseExists(): Promise<boolean> {
  const all = await indexedDB.databases();
  return all.some((info) => info.name === LOCAL_DB_NAME);
}

const base = {
  created_at: T0,
  updated_at: T0,
  synced_at: T0,
  deleted_at: null,
};

/** Rows a pre-cutover build wrote: an archive flag, a memo, a pre-natural day id. */
const OLD_ROWS = {
  activityGroups: [
    {
      id: "g1",
      name: "Health",
      emoji: null,
      color: "green",
      order_index: 0,
      is_archived: false,
      ...base,
    },
  ],
  activities: [
    {
      id: "a1",
      group_id: "g1",
      name: "Run",
      routine: "daily",
      completion_target: 3,
      is_archived: false,
      completed_at: null,
      order_index: 0,
      ...base,
    },
    {
      id: "a2",
      group_id: "g1",
      name: "Old",
      routine: "daily",
      completion_target: 1,
      is_archived: true,
      completed_at: "2026-08-20T00:00:00.000Z",
      order_index: 1,
      ...base,
    },
  ],
  dailyEntries: [
    {
      id: "legacy-day-id",
      date: DAY,
      task_counts: { a1: 2 },
      paused_task_ids: [],
      is_break_day: false,
      completion_notes: {},
      completion_times: {},
      ...base,
    },
  ],
  recurringMemos: [
    { id: "memo1", title: "Water plants", is_active: true, ...base },
  ],
  syncPendingOperations: [
    {
      id: "op1",
      operation_id: "op1",
      status: "failed",
      entity_type: "activity_status_event",
      created_at: T0,
    },
  ],
};

async function resetAll() {
  db.close();
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name);
  }
  storage.clear();
  env.configured = false;
}

/** What the snapshot bootstrap leaves: the server's copy of the day. */
async function bootstrapWithServerCount(count: number) {
  await db.open();
  const day: DailyEntry = {
    id: naturalDailyEntryId(USER, DAY),
    date: DAY,
    task_counts: { a1: count },
    paused_task_ids: [],
    is_break_day: false,
    completion_notes: {},
    completion_times: {},
    ...base,
  };
  await db.dailyEntries.put(day);
}

async function importBundle() {
  const [bundle] = await loadRecoveryBundles();
  const doc = remapBackupIdentity(
    migrateBackupDocument(bundle!.document),
    USER
  );
  return importBackup(doc.tables, { targetUserKey: USER, syncedSequence: 7 });
}

async function countDeltas() {
  return (await db.syncPendingOperations.toArray()).filter(
    (op) => op.operation_type === "count.delta"
  );
}

describe("pre-baseline recovery", () => {
  beforeEach(resetAll);

  it("keeps an old database's rows aside, deletes it, and resets the sync cursor", async () => {
    await seedRawDatabase(31, OLD_ROWS);
    storage.set("okhabit_last_signed_in_user_id", USER);
    storage.set("okhabit_sync_protocol_v2", "1");
    storage.set("okhabit_last_applied_sync_sequence", "42");

    const bundle = await prepareLocalDatabase();

    expect(bundle?.reason).toBe("old_schema");
    expect(bundle?.source_user_id).toBe(USER);
    expect(await localDatabaseExists()).toBe(false);
    expect(storage.get("okhabit_sync_protocol_v2")).toBeUndefined();
    expect(storage.get("okhabit_last_applied_sync_sequence")).toBeUndefined();
    expect(storage.get("okhabit_last_signed_in_user_id")).toBe(USER);
    // The rejected op is carried for download, not replayed.
    const doc = bundle!.document as Record<string, unknown[]>;
    expect(doc.syncPendingOperations).toHaveLength(1);
    expect(doc.recurringMemos).toHaveLength(1);
  });

  it("converts the old shapes the deleted upgrade chain used to convert", async () => {
    await seedRawDatabase(31, OLD_ROWS);
    await prepareLocalDatabase();
    const [bundle] = await loadRecoveryBundles();
    const doc = migrateBackupDocument(bundle!.document);

    const archived = doc.tables.activities.find((a) => a.id === "a2");
    expect(archived?.archived_at).toBeTruthy();
    // The memo became a check-only routine.
    expect(doc.tables.activities.some((a) => a.name === "Water plants")).toBe(
      true
    );
  });

  it("imports with no double count when the server already has the count", async () => {
    await seedRawDatabase(31, OLD_ROWS);
    await prepareLocalDatabase();
    await bootstrapWithServerCount(2);

    await importBundle();
    await importBundle();

    expect(await countDeltas()).toEqual([]);
    const day = await db.dailyEntries.get(naturalDailyEntryId(USER, DAY));
    expect(day?.task_counts).toEqual({ a1: 2 });
    expect(await db.dailyEntries.count()).toBe(1);
  });

  it("adds only the difference a never-pushed change left behind", async () => {
    await seedRawDatabase(31, OLD_ROWS);
    await prepareLocalDatabase();
    await bootstrapWithServerCount(1);

    await importBundle();
    await importBundle();

    const deltas = await countDeltas();
    expect(deltas).toHaveLength(1);
    expect((deltas[0]!.payload as { delta: number }).delta).toBe(1);
  });

  it("opens a v32 database in place and drops only the retired tables", async () => {
    await seedRawDatabase(32, OLD_ROWS);
    storage.set("okhabit_last_signed_in_user_id", USER);

    expect(await prepareLocalDatabase()).toBeNull();
    await db.open();

    expect(await db.activities.get("a1")).toBeTruthy();
    expect(await db.dailyEntries.count()).toBe(1);
    const stores = [...db.backendDB().objectStoreNames];
    expect(stores).not.toContain("recurringMemos");
    expect(stores).not.toContain("activityStatusEvents");
  });

  it("keeps data created signed out aside instead of pushing it", async () => {
    env.configured = true;
    await seedRawDatabase(32, OLD_ROWS);

    const bundle = await prepareLocalDatabase();

    expect(bundle?.reason).toBe("unowned_data");
    expect(bundle?.source_user_id).toBeNull();
    expect(await localDatabaseExists()).toBe(false);
  });

  it("leaves a fresh device alone", async () => {
    expect(await prepareLocalDatabase()).toBeNull();
    expect(await localDatabaseExists()).toBe(false);
  });
});
