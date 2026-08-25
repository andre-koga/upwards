import { beforeEach, describe, expect, it } from "vitest";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import {
  buildTimelineSessions,
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

  it("keeps zero-duration completions and excludes them from duration totals", () => {
    const untimedStart = new Date(2026, 5, 26, 8, 32, 0, 0).toISOString();
    const timedStart = new Date(2026, 5, 26, 9, 0, 0, 0).toISOString();
    const timedEnd = new Date(2026, 5, 26, 9, 12, 0, 0).toISOString();
    const sessions = buildTimelineSessions({
      periods: [
        makePeriod({
          id: "untimed",
          start_time: untimedStart,
          end_time: untimedStart,
          note: "used the blue toothbrush",
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
      lookupActivityById: new Map([["act-1", makeActivity()]]),
      lookupGroupById: new Map([["group-1", makeGroup()]]),
    });

    expect(sessions.map((session) => session.id)).toEqual(["timed", "untimed"]);
    const untimed = sessions.find((session) => session.id === "untimed");
    const timed = sessions.find((session) => session.id === "timed");
    expect(untimed?.untimed).toBe(true);
    expect(untimed?.intervalMs).toBe(0);
    expect(untimed?.note).toBe("used the blue toothbrush");
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

  it("collapses duplicate untimed completions for the same activity", () => {
    const first = new Date(2026, 5, 26, 8, 0, 0, 0).toISOString();
    const second = new Date(2026, 5, 26, 8, 5, 0, 0).toISOString();
    const sessions = buildTimelineSessions({
      periods: [
        makePeriod({
          id: "copy-2",
          created_at: second,
          start_time: second,
          end_time: second,
        }),
        makePeriod({
          id: "copy-1",
          created_at: first,
          start_time: first,
          end_time: first,
        }),
      ],
      dateString: "2026-06-26",
      nowMs: new Date(2026, 5, 26, 12, 0, 0, 0).getTime(),
      lookupActivityById: new Map([["act-1", makeActivity()]]),
      lookupGroupById: new Map([["group-1", makeGroup()]]),
    });

    expect(sessions.map((session) => session.id)).toEqual(["copy-1"]);
  });
});
