import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueMock, pendingEntityIds, tables } = vi.hoisted(() => ({
  enqueueMock: vi.fn(async () => {}),
  pendingEntityIds: new Set<string>(),
  tables: {
    journalEntries: [] as Array<Record<string, unknown>>,
    activityPeriods: [] as Array<Record<string, unknown>>,
    oneTimeTasks: [] as Array<Record<string, unknown>>,
    recurringMemos: [] as Array<Record<string, unknown>>,
    activityStatusEvents: [] as Array<Record<string, unknown>>,
    groupStatusEvents: [] as Array<Record<string, unknown>>,
    activities: [] as Array<Record<string, unknown>>,
    activityGroups: [] as Array<Record<string, unknown>>,
  },
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
});

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  getCachedUserId: () => "user-1",
}));

vi.mock("@/lib/db", () => {
  const tableApi = (rows: Array<Record<string, unknown>>) => ({
    toArray: async () => [...rows],
  });
  return {
    db: {
      journalEntries: tableApi(tables.journalEntries),
      activityPeriods: tableApi(tables.activityPeriods),
      oneTimeTasks: tableApi(tables.oneTimeTasks),
      recurringMemos: tableApi(tables.recurringMemos),
      activityStatusEvents: tableApi(tables.activityStatusEvents),
      groupStatusEvents: tableApi(tables.groupStatusEvents),
      activities: tableApi(tables.activities),
      activityGroups: tableApi(tables.activityGroups),
    },
    now: () => "2026-08-01T12:00:00.000Z",
  };
});

vi.mock("./projection-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./projection-sync")>();
  return {
    ...actual,
    enqueueProjectionUpsertForTable: (
      ...args: Parameters<typeof actual.enqueueProjectionUpsertForTable>
    ) => enqueueMock(...args),
  };
});

vi.mock("./unsynced-data", () => ({
  listPendingEntityIds: async () => new Set(pendingEntityIds),
}));

import {
  clearCutoverEnqueueFlag,
  enqueueUnsyncedCurrentStateRows,
  hasEnqueuedCutoverRows,
} from "./identity-repair";

describe("enqueueUnsyncedCurrentStateRows", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    pendingEntityIds.clear();
    storage.clear();
    for (const rows of Object.values(tables)) {
      rows.length = 0;
    }
  });

  it("enqueues unsynced current-state rows once", async () => {
    tables.activities.push({
      id: "act-1",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
    });
    tables.oneTimeTasks.push({
      id: "task-1",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: "2026-08-01T11:00:00.000Z",
    });
    tables.activities.push({
      id: "act-synced",
      updated_at: "2026-08-01T10:00:00.000Z",
      synced_at: "2026-08-01T11:00:00.000Z",
    });

    await enqueueUnsyncedCurrentStateRows();
    expect(enqueueMock).toHaveBeenCalledTimes(2);
    expect(hasEnqueuedCutoverRows()).toBe(true);

    enqueueMock.mockClear();
    await enqueueUnsyncedCurrentStateRows();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("skips entity ids already waiting in the pending queue", async () => {
    pendingEntityIds.add("act-1");
    tables.activities.push({
      id: "act-1",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
    });
    tables.activities.push({
      id: "act-2",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
    });

    await enqueueUnsyncedCurrentStateRows();
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0][1]).toMatchObject({ id: "act-2" });
  });

  it("skips untimed activity periods", async () => {
    tables.activityPeriods.push({
      id: "period-untimed",
      start_time: "2026-08-01T10:00:00.000Z",
      end_time: "2026-08-01T10:00:00.000Z",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
    });
    tables.activityPeriods.push({
      id: "period-timed",
      start_time: "2026-08-01T10:00:00.000Z",
      end_time: "2026-08-01T10:30:00.000Z",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
    });

    await enqueueUnsyncedCurrentStateRows();
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0][1]).toMatchObject({ id: "period-timed" });
  });

  it("skips locally soft-deleted journal duplicates", async () => {
    // The server enforces UNIQUE(user_id, entry_date), so pushing a duplicate
    // tombstone would collapse onto the surviving row and delete real content.
    tables.journalEntries.push({
      id: "journal-dupe",
      entry_date: "2026-08-01",
      text_content: "duplicate",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
      deleted_at: "2026-08-01T12:00:00.000Z",
    });
    tables.journalEntries.push({
      id: "journal-canonical",
      entry_date: "2026-08-01",
      text_content: "real content",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    });

    await enqueueUnsyncedCurrentStateRows();
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0][1]).toMatchObject({
      id: "journal-canonical",
    });
  });

  it("can enqueue again after the cutover flag is cleared", async () => {
    tables.activities.push({
      id: "act-1",
      updated_at: "2026-08-01T12:00:00.000Z",
      synced_at: null,
    });
    await enqueueUnsyncedCurrentStateRows();
    enqueueMock.mockClear();
    clearCutoverEnqueueFlag();
    await enqueueUnsyncedCurrentStateRows();
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });
});
