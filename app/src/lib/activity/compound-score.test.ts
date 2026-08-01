import { beforeEach, describe, expect, it } from "vitest";
import type {
  Activity,
  ActivityDefinitionVersion,
  DailyEntry,
} from "@/lib/db/types";
import {
  computeCompoundScore,
  formatCompoundScore,
  getScheduledDayOutcome,
} from "./compound-score";

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

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    group_id: "group-1",
    name: "Read",
    routine: "daily",
    completion_target: 1,
    completed_at: null,
    order_index: 0,
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function makeEntry(
  date: string,
  overrides: Partial<DailyEntry> = {}
): DailyEntry {
  return {
    id: `entry-${date}`,
    date,
    task_counts: overrides.task_counts ?? null,
    paused_task_ids: overrides.paused_task_ids ?? null,
    is_break_day: overrides.is_break_day ?? null,
    current_activity_id: null,
    created_at: `${date}T12:00:00.000Z`,
    updated_at: `${date}T12:00:00.000Z`,
    synced_at: null,
    deleted_at: null,
  };
}

describe("getScheduledDayOutcome", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
  });

  it("returns win/loss for scheduled days and skip when not due", () => {
    const weekly = makeActivity({ routine: "weekly:1" }); // Mondays
    const monday = new Date(2026, 5, 15);
    const tuesday = new Date(2026, 5, 16);
    const done = makeEntry("2026-06-15", { task_counts: { "act-1": 1 } });
    expect(getScheduledDayOutcome(weekly, monday, done, new Set())).toBe("win");
    expect(
      getScheduledDayOutcome(weekly, monday, makeEntry("2026-06-15"), new Set())
    ).toBe("loss");
    expect(getScheduledDayOutcome(weekly, tuesday, undefined, new Set())).toBe(
      "skip"
    );
  });

  it("skips paused and break days unless counting break misses", () => {
    const activity = makeActivity();
    const day = new Date(2026, 5, 15);
    const paused = makeEntry("2026-06-15", {
      paused_task_ids: ["act-1"],
      task_counts: {},
    });
    expect(getScheduledDayOutcome(activity, day, paused, new Set())).toBe(
      "skip"
    );

    const missedBreak = makeEntry("2026-06-15", { task_counts: {} });
    expect(
      getScheduledDayOutcome(
        activity,
        day,
        missedBreak,
        new Set(["2026-06-15"])
      )
    ).toBe("skip");
    expect(
      getScheduledDayOutcome(
        activity,
        day,
        missedBreak,
        new Set(["2026-06-15"]),
        { countBreakDayMisses: true }
      )
    ).toBe("loss");
  });

  it("inverts never-task wins and losses", () => {
    const never = makeActivity({ routine: "never" });
    const day = new Date(2026, 5, 15);
    expect(
      getScheduledDayOutcome(never, day, makeEntry("2026-06-15"), new Set())
    ).toBe("win");
    expect(
      getScheduledDayOutcome(
        never,
        day,
        makeEntry("2026-06-15", { task_counts: { "act-1": 1 } }),
        new Set()
      )
    ).toBe("loss");
  });

  it("uses definition version effective on the viewed date", () => {
    const activity = makeActivity({ routine: "weekly:1,2,3,4,5" });
    const versions: ActivityDefinitionVersion[] = [
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
      },
    ];
    const saturday = new Date(2026, 5, 13);
    const monday = new Date(2026, 5, 15);
    const done = makeEntry("2026-06-13", { task_counts: { "act-1": 1 } });

    expect(
      getScheduledDayOutcome(activity, saturday, done, new Set(), {
        definitionVersions: versions,
      })
    ).toBe("win");
    expect(getScheduledDayOutcome(activity, saturday, done, new Set())).toBe(
      "skip"
    );
    expect(
      getScheduledDayOutcome(
        activity,
        monday,
        makeEntry("2026-06-15"),
        new Set(),
        { definitionVersions: versions }
      )
    ).toBe("loss");
  });
});

describe("computeCompoundScore", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
  });

  it("compounds wins and losses from 1.000", () => {
    const activity = makeActivity();
    const entries = new Map<string, DailyEntry>([
      ["2026-06-15", makeEntry("2026-06-15", { task_counts: { "act-1": 1 } })],
      ["2026-06-16", makeEntry("2026-06-16", { task_counts: {} })],
    ]);
    const score = computeCompoundScore(
      activity,
      entries,
      new Set(),
      new Date(2026, 5, 15),
      new Date(2026, 5, 16)
    );
    // 1 * 1.01 * 0.99 = 0.9999 → 1.000 rounded to 3 decimals
    expect(score).toBe(1);
    expect(formatCompoundScore(score)).toBe("1.000");
  });

  it("increases after consecutive wins", () => {
    const activity = makeActivity();
    const entries = new Map<string, DailyEntry>([
      ["2026-06-15", makeEntry("2026-06-15", { task_counts: { "act-1": 1 } })],
      ["2026-06-16", makeEntry("2026-06-16", { task_counts: { "act-1": 1 } })],
    ]);
    const score = computeCompoundScore(
      activity,
      entries,
      new Set(),
      new Date(2026, 5, 15),
      new Date(2026, 5, 16)
    );
    expect(score).toBe(1.02);
  });
});
