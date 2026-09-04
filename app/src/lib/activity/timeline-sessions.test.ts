import { beforeEach, describe, expect, it } from "vitest";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import {
  buildTimelineSessions,
  derivedUntimedSessionId,
  timelineDurationTotalMs,
} from "./timeline-sessions";

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
    name: "Brush teeth",
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

function makeGroup(overrides: Partial<ActivityGroup> = {}): ActivityGroup {
  return {
    id: "group-1",
    name: "Morning",
    emoji: null,
    color: "#336699",
    order_index: 0,
    is_archived: false,
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function makePeriod(overrides: Partial<ActivityPeriod> = {}): ActivityPeriod {
  const t = new Date(2026, 5, 26, 8, 32, 0, 0).toISOString();
  return {
    id: "p1",
    daily_entry_id: "entry-1",
    activity_id: "act-1",
    start_time: t,
    end_time: t,
    note: "minty",
    created_at: t,
    updated_at: t,
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("buildTimelineSessions", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
  });

  it("derives untimed pills from counts and ignores leftover zero-duration rows", () => {
    const leftoverStart = new Date(2026, 5, 26, 8, 32, 0, 0).toISOString();
    const timedStart = new Date(2026, 5, 26, 9, 0, 0, 0).toISOString();
    const timedEnd = new Date(2026, 5, 26, 9, 12, 0, 0).toISOString();
    const other = makeActivity({
      id: "act-2",
      name: "Make bed",
      group_id: "group-1",
    });
    const sessions = buildTimelineSessions({
      periods: [
        makePeriod({
          id: "untimed-leftover",
          start_time: leftoverStart,
          end_time: leftoverStart,
          note: "should not appear",
        }),
        makePeriod({
          id: "timed",
          start_time: timedStart,
          end_time: timedEnd,
          note: null,
        }),
      ],
      dateString: "2026-06-26",
      nowMs: new Date(2026, 5, 26, 12, 0, 0, 0).getTime(),
      lookupActivityById: new Map([
        ["act-1", makeActivity()],
        ["act-2", other],
      ]),
      lookupGroupById: new Map([["group-1", makeGroup()]]),
      taskCounts: { "act-1": 1, "act-2": 1 },
      completionNotes: { "act-2": "tucked tight" },
      completionTimes: { "act-2": "2026-06-26T15:47:00.000Z" },
    });

    expect(sessions.map((session) => session.id)).toEqual([
      derivedUntimedSessionId("2026-06-26", "act-2"),
      "timed",
    ]);
    const derived = sessions.find((session) => session.untimed);
    const timed = sessions.find((session) => session.id === "timed");
    expect(derived?.note).toBe("tucked tight");
    expect(derived?.completedAtIso).toBe("2026-06-26T15:47:00.000Z");
    expect(derived?.startTime).toBe(
      new Date("2026-06-26T15:47:00.000Z").getTime()
    );
    expect(derived?.intervalMs).toBe(0);
    expect(timed?.untimed).toBe(false);
    expect(timed?.intervalMs).toBe(12 * 60 * 1000);
    expect(timelineDurationTotalMs(sessions)).toBe(12 * 60 * 1000);
  });

  it("drops running periods and deleted rows", () => {
    const sessions = buildTimelineSessions({
      periods: [
        makePeriod({ id: "running", end_time: null }),
        makePeriod({
          id: "deleted",
          deleted_at: "2026-06-26T12:00:00.000Z",
        }),
      ],
      dateString: "2026-06-26",
      nowMs: Date.now(),
      lookupActivityById: new Map([["act-1", makeActivity()]]),
      lookupGroupById: new Map([["group-1", makeGroup()]]),
    });
    expect(sessions).toEqual([]);
  });

  it("does not derive an untimed pill when a timed session already exists", () => {
    const timedStart = new Date(2026, 5, 26, 9, 0, 0, 0).toISOString();
    const timedEnd = new Date(2026, 5, 26, 9, 12, 0, 0).toISOString();
    const sessions = buildTimelineSessions({
      periods: [
        makePeriod({
          id: "timed",
          start_time: timedStart,
          end_time: timedEnd,
        }),
      ],
      dateString: "2026-06-26",
      nowMs: new Date(2026, 5, 26, 12, 0, 0, 0).getTime(),
      lookupActivityById: new Map([["act-1", makeActivity()]]),
      lookupGroupById: new Map([["group-1", makeGroup()]]),
      taskCounts: { "act-1": 1 },
    });

    expect(sessions.map((session) => session.id)).toEqual(["timed"]);
  });
});
