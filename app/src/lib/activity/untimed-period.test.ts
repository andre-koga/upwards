import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityPeriod } from "@/lib/db/types";
import { isUntimedPeriod, periodsBelongingToDay } from "./untimed-period";

const RESET_MIDNIGHT = 0;

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
  });
});
