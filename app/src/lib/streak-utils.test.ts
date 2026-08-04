import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity, ActivityStreak, DailyEntry } from "@/lib/db/types";

const storage = new Map<string, string>();

function mockLocalStorage() {
  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
  } as Storage;
}

const dailyEntries: DailyEntry[] = [];
const activityStreaks: ActivityStreak[] = [];
const activityDefinitionVersions: import("@/lib/db/types").ActivityDefinitionVersion[] =
  [];
let idCounter = 0;

vi.mock("@/lib/db", () => ({
  db: {
    dailyEntries: {
      where: (_index: string) => ({
        between: (start: string, end: string) => ({
          filter: (predicate: (entry: DailyEntry) => boolean) => ({
            toArray: async () =>
              dailyEntries.filter(
                (entry) =>
                  entry.date >= start && entry.date <= end && predicate(entry)
              ),
          }),
        }),
      }),
    },
    activityDefinitionVersions: {
      where: (_index: string) => ({
        equals: (activityId: string) => ({
          filter: (
            predicate: (
              row: import("@/lib/db/types").ActivityDefinitionVersion
            ) => boolean
          ) => ({
            toArray: async () =>
              activityDefinitionVersions.filter(
                (row) => row.activity_id === activityId && predicate(row)
              ),
          }),
        }),
      }),
    },
    activityStreaks: {
      where: (_index: string) => ({
        equals: ([activityId, date]: [string, string]) => ({
          filter: (predicate: (row: ActivityStreak) => boolean) => ({
            first: async () =>
              activityStreaks.find(
                (row) =>
                  row.activity_id === activityId &&
                  row.date === date &&
                  predicate(row)
              ),
          }),
        }),
      }),
      update: async (id: string, patch: Partial<ActivityStreak>) => {
        const row = activityStreaks.find((r) => r.id === id);
        if (row) Object.assign(row, patch);
      },
      add: async (row: ActivityStreak) => {
        activityStreaks.push(row);
      },
    },
  },
  newId: () => `streak-${++idCounter}`,
  now: () => "2026-06-18T12:00:00.000Z",
}));

import { getOrComputeActivityStreaksForDate } from "./streak-utils";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    group_id: "group-1",
    name: "Read",
    routine: "daily",
    completion_target: 1,
    completed_at: null,
    order_index: 0,
    created_at: "2026-06-10T12:00:00.000Z",
    updated_at: "2026-06-10T12:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function addEntry(
  date: string,
  overrides: Partial<DailyEntry> = {}
): DailyEntry {
  const entry: DailyEntry = {
    id: `entry-${date}`,
    date,
    task_counts: overrides.task_counts ?? null,
    paused_task_ids: overrides.paused_task_ids ?? null,
    is_break_day: overrides.is_break_day ?? null,
    current_activity_id: null,
    created_at: `${date}T12:00:00.000Z`,
    updated_at: `${date}T12:00:00.000Z`,
    synced_at: null,
    deleted_at: overrides.deleted_at ?? null,
  };
  dailyEntries.push(entry);
  return entry;
}

describe("getOrComputeActivityStreaksForDate", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
    dailyEntries.length = 0;
    activityStreaks.length = 0;
    activityDefinitionVersions.length = 0;
    idCounter = 0;
  });

  it("counts consecutive done days and stops on a miss", async () => {
    const activity = makeActivity();
    addEntry("2026-06-15", { task_counts: { "act-1": 1 } });
    addEntry("2026-06-16", { task_counts: { "act-1": 1 } });
    addEntry("2026-06-17", { task_counts: {} }); // miss
    addEntry("2026-06-18", { task_counts: { "act-1": 1 } });

    const streaks = await getOrComputeActivityStreaksForDate(
      [activity],
      new Date(2026, 5, 18)
    );
    expect(streaks["act-1"]).toBe(1);
    expect(activityStreaks).toHaveLength(1);
    expect(activityStreaks[0]?.streak).toBe(1);
  });

  it("skips break days and paused days without breaking the streak", async () => {
    const activity = makeActivity();
    addEntry("2026-06-15", { task_counts: { "act-1": 1 } });
    addEntry("2026-06-16", {
      is_break_day: true,
      task_counts: {},
    });
    addEntry("2026-06-17", {
      paused_task_ids: ["act-1"],
      task_counts: {},
    });
    addEntry("2026-06-18", { task_counts: { "act-1": 1 } });

    const streaks = await getOrComputeActivityStreaksForDate(
      [activity],
      new Date(2026, 5, 18)
    );
    expect(streaks["act-1"]).toBe(2);
  });

  it("inverts never-task semantics (no slip keeps the streak)", async () => {
    const never = makeActivity({ routine: "never" });
    addEntry("2026-06-16", { task_counts: {} });
    addEntry("2026-06-17", { task_counts: { "act-1": 1 } }); // slip
    addEntry("2026-06-18", { task_counts: {} });

    const streaks = await getOrComputeActivityStreaksForDate(
      [never],
      new Date(2026, 5, 18)
    );
    expect(streaks["act-1"]).toBe(1);
  });

  it("uses todayOverride instead of waiting for a DB write", async () => {
    const activity = makeActivity();
    addEntry("2026-06-17", { task_counts: { "act-1": 1 } });
    // No 2026-06-18 row in DB yet

    const streaks = await getOrComputeActivityStreaksForDate(
      [activity],
      new Date(2026, 5, 18),
      {
        todayOverride: {
          date: "2026-06-18",
          taskCounts: { "act-1": 1 },
          pausedTaskIds: [],
          isBreakDay: false,
        },
      }
    );
    expect(streaks["act-1"]).toBe(2);
  });

  it("returns 0 for anytime habits", async () => {
    const anytime = makeActivity({ routine: "anytime" });
    addEntry("2026-06-18", { task_counts: { "act-1": 1 } });
    const streaks = await getOrComputeActivityStreaksForDate(
      [anytime],
      new Date(2026, 5, 18)
    );
    expect(streaks["act-1"]).toBe(0);
  });

  it("preserves streak across definition version changes", async () => {
    const activity = makeActivity({
      created_at: "2026-06-01T12:00:00.000Z",
      routine: "daily",
    });
    activityDefinitionVersions.push(
      {
        id: "v1",
        activity_id: "act-1",
        parent_version_id: null,
        effective_from: "2026-06-01",
        recorded_at: "2026-06-01T12:00:00.000Z",
        server_sequence: null,
        operation_id: "op-v1",
        device_id: "device-1",
        name: "Read",
        routine: "daily",
        completion_target: 1,
        group_id: "group-1",
        order_index: 0,
        schema_version: 1,
        created_at: "2026-06-01T12:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "v2",
        activity_id: "act-1",
        parent_version_id: "v1",
        effective_from: "2026-06-15",
        recorded_at: "2026-06-15T12:00:00.000Z",
        server_sequence: null,
        operation_id: "op-v2",
        device_id: "device-1",
        name: "Read",
        routine: "daily",
        completion_target: 2,
        group_id: "group-1",
        order_index: 0,
        schema_version: 1,
        created_at: "2026-06-15T12:00:00.000Z",
        deleted_at: null,
      }
    );
    addEntry("2026-06-13", { task_counts: { "act-1": 1 } });
    addEntry("2026-06-14", { task_counts: { "act-1": 1 } });
    addEntry("2026-06-15", { task_counts: { "act-1": 2 } });
    addEntry("2026-06-16", { task_counts: { "act-1": 2 } });
    addEntry("2026-06-17", { task_counts: { "act-1": 2 } });
    addEntry("2026-06-18", { task_counts: { "act-1": 2 } });

    const streaks = await getOrComputeActivityStreaksForDate(
      [activity],
      new Date(2026, 5, 18)
    );
    expect(streaks["act-1"]).toBe(6);
  });

  it("preserves historical weekend streak after routine changes to weekdays", async () => {
    const activity = makeActivity({ routine: "weekly:1,2,3,4,5" });
    activityDefinitionVersions.push(
      {
        id: "v1",
        activity_id: "act-1",
        parent_version_id: null,
        effective_from: "2026-06-01",
        recorded_at: "2026-06-01T12:00:00.000Z",
        server_sequence: null,
        operation_id: "op-v1",
        device_id: "device-1",
        name: "Read",
        routine: "weekly:0,6",
        completion_target: 1,
        group_id: "group-1",
        order_index: 0,
        schema_version: 1,
        created_at: "2026-06-01T12:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "v2",
        activity_id: "act-1",
        parent_version_id: "v1",
        effective_from: "2026-06-15",
        recorded_at: "2026-06-15T12:00:00.000Z",
        server_sequence: null,
        operation_id: "op-v2",
        device_id: "device-1",
        name: "Read",
        routine: "weekly:1,2,3,4,5",
        completion_target: 1,
        group_id: "group-1",
        order_index: 0,
        schema_version: 1,
        created_at: "2026-06-15T12:00:00.000Z",
        deleted_at: null,
      }
    );
    addEntry("2026-06-13", { task_counts: { "act-1": 1 } }); // Saturday under weekend schedule
    addEntry("2026-06-14", { task_counts: { "act-1": 1 } }); // Sunday under weekend schedule

    const streaks = await getOrComputeActivityStreaksForDate(
      [activity],
      new Date(2026, 5, 14)
    );
    expect(streaks["act-1"]).toBe(2);
  });
});
