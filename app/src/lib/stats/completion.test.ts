import { beforeEach, describe, expect, it } from "vitest";
import type { Activity, DailyEntry } from "@/lib/db/types";
import {
  buildActivityCompletionByDate,
  buildBreakDaysSet,
  completionRate,
  computeActivityCompletionTotals,
  computeCompletionTotals,
  isCountableRoutine,
} from "./completion";

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

describe("completion stats helpers", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
  });

  it("filters countable routines", () => {
    expect(isCountableRoutine(makeActivity())).toBe(true);
    expect(isCountableRoutine(makeActivity({ routine: "anytime" }))).toBe(
      false
    );
    expect(isCountableRoutine(makeActivity({ routine: "never" }))).toBe(false);
    expect(
      isCountableRoutine(
        makeActivity({ completed_at: "2026-06-01T00:00:00.000Z" })
      )
    ).toBe(false);
    expect(
      isCountableRoutine(
        makeActivity({ completed_at: "2026-06-01T00:00:00.000Z" }),
        { includeCompleted: true }
      )
    ).toBe(true);
  });

  it("builds completion maps with break / missed / never slip states", () => {
    const activity = makeActivity();
    const entries = new Map<string, DailyEntry>([
      ["2026-06-15", makeEntry("2026-06-15", { task_counts: { "act-1": 1 } })],
      [
        "2026-06-16",
        makeEntry("2026-06-16", {
          is_break_day: true,
          task_counts: {},
        }),
      ],
      ["2026-06-17", makeEntry("2026-06-17", { task_counts: {} })],
    ]);
    const breakDays = buildBreakDaysSet([...entries.values()]);
    const map = buildActivityCompletionByDate(
      activity,
      entries,
      breakDays,
      new Date(2026, 5, 15),
      new Date(2026, 5, 17)
    );
    expect(map["2026-06-15"]).toBe("done");
    expect(map["2026-06-16"]).toBe("break");
    expect(map["2026-06-17"]).toBe("missed");

    const never = makeActivity({ routine: "never" });
    const neverMap = buildActivityCompletionByDate(
      never,
      new Map([
        [
          "2026-06-15",
          makeEntry("2026-06-15", { task_counts: { "act-1": 1 } }),
        ],
      ]),
      new Set(),
      new Date(2026, 5, 15),
      new Date(2026, 5, 15)
    );
    expect(neverMap["2026-06-15"]).toBe("slip");
  });

  it("totals countable days and rates", () => {
    const totals = computeActivityCompletionTotals(
      {
        "2026-06-15": "done",
        "2026-06-16": "missed",
        "2026-06-17": "break",
        "2026-06-18": "not_scheduled",
        "2026-06-19": "slip",
      },
      new Date(2026, 5, 15),
      new Date(2026, 5, 19)
    );
    expect(totals).toEqual({ completed: 1, scheduled: 3 });
    expect(completionRate(1, 3)).toBe(33);
    expect(completionRate(0, 0)).toBeNull();
  });

  it("aggregates group completion across countable activities", () => {
    const activities = [
      makeActivity({ id: "a1" }),
      makeActivity({ id: "a2", routine: "anytime" }),
    ];
    const entries = new Map<string, DailyEntry>([
      [
        "2026-06-15",
        makeEntry("2026-06-15", { task_counts: { a1: 1, a2: 1 } }),
      ],
      ["2026-06-16", makeEntry("2026-06-16", { task_counts: { a1: 0 } })],
    ]);
    const totals = computeCompletionTotals(
      activities,
      entries,
      new Set(),
      new Date(2026, 5, 15),
      new Date(2026, 5, 16)
    );
    expect(totals).toEqual({ completed: 1, scheduled: 2 });
  });
});
