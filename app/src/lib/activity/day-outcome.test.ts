import { beforeEach, describe, expect, it } from "vitest";
import type { Activity, DailyEntry } from "@/lib/db/types";
import { getScheduledDayOutcome } from "./day-outcome";

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
    is_archived: false,
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

  it("uses the current activity row, not a stored definition history", () => {
    const activity = makeActivity({ routine: "weekly:1,2,3,4,5" });
    const saturday = new Date(2026, 5, 13);
    const monday = new Date(2026, 5, 15);
    const done = makeEntry("2026-06-13", { task_counts: { "act-1": 1 } });

    expect(getScheduledDayOutcome(activity, saturday, done, new Set())).toBe(
      "skip"
    );
    expect(
      getScheduledDayOutcome(
        activity,
        monday,
        makeEntry("2026-06-15"),
        new Set()
      )
    ).toBe("loss");
  });
});
