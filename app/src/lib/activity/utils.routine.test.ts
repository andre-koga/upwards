import { beforeEach, describe, expect, it } from "vitest";
import {
  formatTimerDisplay,
  isRoutineDueOnDate,
  parseRoutine,
  sortActivitiesByOrder,
} from "./utils";
import type { Activity } from "@/lib/db/types";

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

function activity(
  overrides: Partial<Activity> & Pick<Activity, "routine">
): Pick<Activity, "routine" | "created_at"> {
  return {
    routine: overrides.routine,
    created_at: overrides.created_at ?? "2026-01-01T12:00:00.000Z",
  };
}

describe("parseRoutine", () => {
  it("parses known routine shapes", () => {
    expect(parseRoutine(null)).toEqual({ type: "daily" });
    expect(parseRoutine("daily")).toEqual({ type: "daily" });
    expect(parseRoutine("anytime")).toEqual({ type: "anytime" });
    expect(parseRoutine("never")).toEqual({ type: "never" });
    expect(parseRoutine("weekly:1,3,5")).toEqual({
      type: "weekly",
      days: [1, 3, 5],
    });
    expect(parseRoutine("monthly:15")).toEqual({ type: "monthly", day: 15 });
    expect(parseRoutine("custom:2:weeks")).toEqual({
      type: "custom",
      interval: 2,
      unit: "weeks",
    });
    expect(parseRoutine("weird")).toEqual({ type: "unknown", raw: "weird" });
  });
});

describe("isRoutineDueOnDate", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "240");
  });

  it("returns false for anytime and before creation day", () => {
    expect(
      isRoutineDueOnDate(
        activity({ routine: "anytime" }),
        new Date(2026, 5, 15)
      )
    ).toBe(false);
    expect(
      isRoutineDueOnDate(
        activity({
          routine: "daily",
          created_at: "2026-06-10T12:00:00.000Z",
        }),
        new Date(2026, 5, 9)
      )
    ).toBe(false);
  });

  it("treats daily and never as due every day after creation", () => {
    const day = new Date(2026, 5, 15);
    expect(isRoutineDueOnDate(activity({ routine: "daily" }), day)).toBe(true);
    expect(isRoutineDueOnDate(activity({ routine: "never" }), day)).toBe(true);
  });

  it("matches weekly and monthly routines", () => {
    // 2026-06-15 is a Monday (getDay() === 1)
    const monday = new Date(2026, 5, 15);
    const tuesday = new Date(2026, 5, 16);
    expect(
      isRoutineDueOnDate(activity({ routine: "weekly:1,3,5" }), monday)
    ).toBe(true);
    expect(
      isRoutineDueOnDate(activity({ routine: "weekly:1,3,5" }), tuesday)
    ).toBe(false);
    expect(
      isRoutineDueOnDate(activity({ routine: "monthly:15" }), monday)
    ).toBe(true);
    expect(isRoutineDueOnDate(activity({ routine: "monthly:1" }), monday)).toBe(
      false
    );
  });

  it("matches custom day intervals from creation", () => {
    const created = "2026-06-01T12:00:00.000Z";
    expect(
      isRoutineDueOnDate(
        activity({ routine: "custom:3:days", created_at: created }),
        new Date(2026, 5, 1)
      )
    ).toBe(true);
    expect(
      isRoutineDueOnDate(
        activity({ routine: "custom:3:days", created_at: created }),
        new Date(2026, 5, 4)
      )
    ).toBe(true);
    expect(
      isRoutineDueOnDate(
        activity({ routine: "custom:3:days", created_at: created }),
        new Date(2026, 5, 2)
      )
    ).toBe(false);
  });

  it("uses effective creation day across the reset boundary", () => {
    // Created at 2 AM on June 15 with 4 AM reset → effective day is June 14
    const createdAt = new Date(2026, 5, 15, 2, 0, 0, 0).toISOString();
    expect(
      isRoutineDueOnDate(
        activity({ routine: "daily", created_at: createdAt }),
        new Date(2026, 5, 14)
      )
    ).toBe(true);
    expect(
      isRoutineDueOnDate(
        activity({ routine: "daily", created_at: createdAt }),
        new Date(2026, 5, 13)
      )
    ).toBe(false);
  });
});

describe("formatTimerDisplay / sortActivitiesByOrder", () => {
  it("formats timer displays under and over one hour", () => {
    expect(formatTimerDisplay(65_000)).toBe("01:05");
    expect(formatTimerDisplay(3_661_000)).toBe("01:01:01");
  });

  it("sorts by order_index then created_at", () => {
    const activities = [
      {
        id: "b",
        group_id: "g",
        name: "B",
        routine: "daily",
        completion_target: 1,
        is_archived: false,
        completed_at: null,
        order_index: 2,
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        synced_at: null,
        deleted_at: null,
      },
      {
        id: "a",
        group_id: "g",
        name: "A",
        routine: "daily",
        completion_target: 1,
        is_archived: false,
        completed_at: null,
        order_index: 1,
        created_at: "2026-01-03T00:00:00.000Z",
        updated_at: "2026-01-03T00:00:00.000Z",
        synced_at: null,
        deleted_at: null,
      },
      {
        id: "c",
        group_id: "g",
        name: "C",
        routine: "daily",
        completion_target: 1,
        is_archived: false,
        completed_at: null,
        order_index: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        synced_at: null,
        deleted_at: null,
      },
    ] satisfies Activity[];

    expect(sortActivitiesByOrder(activities).map((a) => a.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});
