import { beforeEach, describe, expect, it } from "vitest";
import type { Activity, DailyEntry } from "@/lib/db/types";
import {
  buildActivityStreakOutcomesByDate,
  deriveCurrentStreakFromOutcomes,
  deriveStreakSeriesFromOutcomes,
} from "./projection";
import { buildBreakDaysSet, buildEntriesByDateMap } from "./entry-maps";

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
    created_at: "2026-06-10T12:00:00.000Z",
    updated_at: "2026-06-10T12:00:00.000Z",
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

describe("streak projection", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
  });

  it("derives current streak from pre-built outcomes", () => {
    const outcomes = {
      "2026-06-15": "win",
      "2026-06-16": "win",
      "2026-06-17": "loss",
      "2026-06-18": "win",
    } as const;

    expect(
      deriveCurrentStreakFromOutcomes(
        outcomes,
        new Date(2026, 5, 18),
        new Date(2026, 5, 10)
      )
    ).toBe(1);
    expect(
      deriveCurrentStreakFromOutcomes(
        outcomes,
        new Date(2026, 5, 16),
        new Date(2026, 5, 10)
      )
    ).toBe(2);
  });

  it("builds outcomes and streak series from daily entries", () => {
    const activity = makeActivity();
    const entries = [
      makeEntry("2026-06-15", { task_counts: { "act-1": 1 } }),
      makeEntry("2026-06-16", { is_break_day: true, task_counts: {} }),
      makeEntry("2026-06-17", {
        paused_task_ids: ["act-1"],
        task_counts: {},
      }),
      makeEntry("2026-06-18", { task_counts: { "act-1": 1 } }),
    ];
    const entriesByDate = buildEntriesByDateMap(entries);
    const breakDays = buildBreakDaysSet(entries);
    const from = new Date(2026, 5, 15);
    const to = new Date(2026, 5, 18);

    const outcomes = buildActivityStreakOutcomesByDate(
      activity,
      entriesByDate,
      breakDays,
      from,
      to,
      { isVisibleOnDay: () => true }
    );

    expect(outcomes["2026-06-16"]).toBe("skip");
    expect(outcomes["2026-06-17"]).toBe("skip");

    const series = deriveStreakSeriesFromOutcomes(
      outcomes,
      from,
      to,
      new Date(2026, 5, 10)
    );
    expect(series["2026-06-15"]).toBe(1);
    expect(series["2026-06-16"]).toBe(1);
    expect(series["2026-06-17"]).toBe(1);
    expect(series["2026-06-18"]).toBe(2);

    expect(
      deriveCurrentStreakFromOutcomes(outcomes, to, new Date(2026, 5, 10))
    ).toBe(2);
  });
});
