import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityPeriod } from "@/lib/db/types";
import { effectiveDayStartMs } from "./period-day-utils";
import {
  buildUntimedPeriod,
  extraUntimedPeriodIdsToTombstone,
  findUntimedAmong,
  isUntimedPeriod,
  periodsBelongingToDay,
  resolveClosedSessionTimes,
  untimedCompletionAction,
  untimedPeriodBelongsToDay,
} from "./untimed-period";

const RESET_MIDNIGHT = 0;
const RESET_5AM = 300;

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

function setResetMinutes(minutes: number) {
  localStorage.setItem("okhabit:day_reset_minutes", String(minutes));
}

function localIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): string {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function makePeriod(overrides: Partial<ActivityPeriod> = {}): ActivityPeriod {
  const t = "2026-06-26T15:00:00.000Z";
  return {
    id: "p1",
    daily_entry_id: "entry-1",
    activity_id: "act-1",
    start_time: t,
    end_time: t,
    note: null,
    created_at: t,
    updated_at: t,
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("untimed period helpers", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    setResetMinutes(RESET_MIDNIGHT);
  });

  it("treats equal start and end as untimed", () => {
    const iso = localIso(2026, 6, 26, 8, 32);
    expect(isUntimedPeriod(iso, iso)).toBe(true);
    expect(isUntimedPeriod(iso, null)).toBe(false);
    expect(isUntimedPeriod(iso, localIso(2026, 6, 26, 8, 40))).toBe(false);
  });

  it("places a point-in-time completion on the effective day", () => {
    const startMs = new Date(2026, 5, 26, 0, 0, 0, 0).getTime();
    expect(untimedPeriodBelongsToDay(startMs, "2026-06-26")).toBe(true);

    const justBeforeNext = new Date(2026, 5, 26, 23, 59, 59, 0).getTime();
    expect(untimedPeriodBelongsToDay(justBeforeNext, "2026-06-26")).toBe(true);

    const nextMidnight = new Date(2026, 5, 27, 0, 0, 0, 0).getTime();
    expect(untimedPeriodBelongsToDay(nextMidnight, "2026-06-26")).toBe(false);
    expect(untimedPeriodBelongsToDay(nextMidnight, "2026-06-27")).toBe(true);
  });

  it("includes a completion exactly at a non-midnight reset", () => {
    setResetMinutes(RESET_5AM);
    const atReset = new Date(2026, 5, 26, 5, 0, 0, 0).getTime();
    expect(effectiveDayStartMs("2026-06-26")).toBe(atReset);
    expect(untimedPeriodBelongsToDay(atReset, "2026-06-26")).toBe(true);
    expect(untimedPeriodBelongsToDay(atReset, "2026-06-25")).toBe(false);
  });

  it("builds a zero-duration period", () => {
    const completedAt = localIso(2026, 6, 26, 8, 32);
    const period = buildUntimedPeriod({
      id: "p-new",
      dailyEntryId: "entry-1",
      activityId: "act-1",
      completedAt,
    });
    expect(period.start_time).toBe(completedAt);
    expect(period.end_time).toBe(completedAt);
    expect(isUntimedPeriod(period.start_time, period.end_time)).toBe(true);
  });

  it("creates on crossing target and tombstones on uncheck", () => {
    expect(
      untimedCompletionAction({
        previousCount: 0,
        nextCount: 1,
        target: 1,
      })
    ).toBe("create");
    expect(
      untimedCompletionAction({
        previousCount: 1,
        nextCount: 0,
        target: 1,
      })
    ).toBe("tombstone");
    expect(
      untimedCompletionAction({
        previousCount: 2,
        nextCount: 3,
        target: 8,
      })
    ).toBe("none");
    expect(
      untimedCompletionAction({
        previousCount: 7,
        nextCount: 8,
        target: 8,
      })
    ).toBe("create");
    expect(
      untimedCompletionAction({
        previousCount: 0,
        nextCount: 1,
        target: 1,
        neverSlip: true,
      })
    ).toBe("none");
  });

  it("keeps zero-duration completions when filtering periods for a day", () => {
    const instant = new Date(2026, 5, 26, 8, 32, 0, 0).toISOString();
    const untimed = makePeriod({
      id: "untimed",
      start_time: instant,
      end_time: instant,
    });
    const timed = makePeriod({
      id: "timed",
      start_time: new Date(2026, 5, 26, 9, 0, 0, 0).toISOString(),
      end_time: new Date(2026, 5, 26, 9, 30, 0, 0).toISOString(),
    });
    const otherDay = makePeriod({
      id: "other",
      start_time: new Date(2026, 5, 27, 8, 0, 0, 0).toISOString(),
      end_time: new Date(2026, 5, 27, 8, 0, 0, 0).toISOString(),
    });
    const nowMs = new Date(2026, 5, 26, 12, 0, 0, 0).getTime();
    const onDay = periodsBelongingToDay(
      [untimed, timed, otherDay],
      "2026-06-26",
      nowMs
    );
    expect(onDay.map((period) => period.id)).toEqual(["untimed", "timed"]);
    expect(findUntimedAmong(onDay, "act-1")?.id).toBe("untimed");
  });
});

describe("resolveClosedSessionTimes", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    setResetMinutes(RESET_MIDNIGHT);
  });

  it("keeps an existing untimed instant when both fields are empty", () => {
    const completedAt = localIso(2026, 6, 26, 8, 32);
    const result = resolveClosedSessionTimes({
      startTime: "",
      endTime: "",
      logicalDateStr: "2026-06-26",
      resetMinutes: RESET_MIDNIGHT,
      existingStartIso: completedAt,
      existingEndIso: completedAt,
      createdAt: completedAt,
    });
    expect(result).toEqual({
      ok: true,
      startIso: completedAt,
      endIso: completedAt,
    });
  });

  it("uses created_at when clearing times on a timed session", () => {
    const createdAt = localIso(2026, 6, 26, 7, 0);
    const result = resolveClosedSessionTimes({
      startTime: "",
      endTime: "",
      logicalDateStr: "2026-06-26",
      resetMinutes: RESET_MIDNIGHT,
      existingStartIso: localIso(2026, 6, 26, 9, 0),
      existingEndIso: localIso(2026, 6, 26, 9, 30),
      createdAt,
    });
    expect(result).toEqual({
      ok: true,
      startIso: createdAt,
      endIso: createdAt,
    });
  });

  it("rejects only one time filled", () => {
    expect(
      resolveClosedSessionTimes({
        startTime: "09:00:00",
        endTime: "",
        logicalDateStr: "2026-06-26",
        resetMinutes: RESET_MIDNIGHT,
        existingStartIso: localIso(2026, 6, 26, 8, 0),
        existingEndIso: localIso(2026, 6, 26, 8, 0),
        createdAt: localIso(2026, 6, 26, 8, 0),
      })
    ).toEqual({ ok: false, error: "one_time" });
  });

  it("resolves equal filled times as an untimed completion", () => {
    const result = resolveClosedSessionTimes({
      startTime: "09:00:00",
      endTime: "09:00:00",
      logicalDateStr: "2026-06-26",
      resetMinutes: RESET_MIDNIGHT,
      existingStartIso: localIso(2026, 6, 26, 8, 0),
      existingEndIso: localIso(2026, 6, 26, 8, 0),
      createdAt: localIso(2026, 6, 26, 8, 0),
    });
    expect(result).toEqual({
      ok: true,
      startIso: localIso(2026, 6, 26, 9, 0),
      endIso: localIso(2026, 6, 26, 9, 0),
    });
  });

  it("resolves a timed span when both times are set", () => {
    const result = resolveClosedSessionTimes({
      startTime: "09:00:00",
      endTime: "09:30:00",
      logicalDateStr: "2026-06-26",
      resetMinutes: RESET_MIDNIGHT,
      existingStartIso: localIso(2026, 6, 26, 8, 0),
      existingEndIso: localIso(2026, 6, 26, 8, 0),
      createdAt: localIso(2026, 6, 26, 8, 0),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Date(result.endIso).getTime()).toBeGreaterThan(
      new Date(result.startIso).getTime()
    );
  });

  it("keeps the earliest untimed row and tombstones later copies", () => {
    const first = localIso(2026, 6, 26, 8, 0);
    const second = localIso(2026, 6, 26, 8, 5);
    expect(
      extraUntimedPeriodIdsToTombstone([
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
        makePeriod({
          id: "timed",
          activity_id: "act-2",
          start_time: first,
          end_time: second,
        }),
      ])
    ).toEqual(["copy-2"]);
  });
});
