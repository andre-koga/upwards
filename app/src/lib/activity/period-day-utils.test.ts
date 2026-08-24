import { beforeEach, describe, expect, it } from "vitest";
import {
  effectiveDateForMs,
  getLogicalEndDate,
  periodBelongsToDay,
  resolvePeriodFromLogicalDay,
  spansLogicalDays,
} from "./period-day-utils";

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

function localMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

describe("resolvePeriodFromLogicalDay", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    setResetMinutes(RESET_5AM);
  });

  it("maps early-morning block to next calendar day on same logical day", () => {
    const result = resolvePeriodFromLogicalDay(
      "2026-06-26",
      "01:00:00",
      "01:30:00",
      RESET_5AM
    );

    expect(result.startMs).toBe(localMs(2026, 6, 27, 1, 0));
    expect(result.endMs).toBe(localMs(2026, 6, 27, 1, 30));
    expect(spansLogicalDays(result.startMs, result.endMs)).toBe(false);
    expect(effectiveDateForMs(result.startMs)).toBe("2026-06-26");
  });

  it("spans logical days for same-calendar 3 AM–6 AM with 5 AM reset", () => {
    const result = resolvePeriodFromLogicalDay(
      "2026-06-27",
      "03:00:00",
      "06:00:00",
      RESET_5AM
    );

    expect(result.startMs).toBe(localMs(2026, 6, 27, 3, 0));
    expect(result.endMs).toBe(localMs(2026, 6, 27, 6, 0));
    expect(effectiveDateForMs(result.startMs)).toBe("2026-06-26");
    expect(getLogicalEndDate(result.startMs, result.endMs)).toBe("2026-06-27");
    expect(spansLogicalDays(result.startMs, result.endMs)).toBe(true);
  });

  it("keeps late-night session on one logical day", () => {
    const result = resolvePeriodFromLogicalDay(
      "2026-06-26",
      "23:00:00",
      "02:00:00",
      RESET_5AM
    );

    expect(result.startMs).toBe(localMs(2026, 6, 26, 23, 0));
    expect(result.endMs).toBe(localMs(2026, 6, 27, 2, 0));
    expect(spansLogicalDays(result.startMs, result.endMs)).toBe(false);
    expect(effectiveDateForMs(result.startMs)).toBe("2026-06-26");
    expect(getLogicalEndDate(result.startMs, result.endMs)).toBe("2026-06-26");
  });

  it("spans logical days for late night through morning reset", () => {
    const result = resolvePeriodFromLogicalDay(
      "2026-06-26",
      "23:00:00",
      "06:00:00",
      RESET_5AM
    );

    expect(result.startMs).toBe(localMs(2026, 6, 26, 23, 0));
    expect(result.endMs).toBe(localMs(2026, 6, 27, 6, 0));
    expect(spansLogicalDays(result.startMs, result.endMs)).toBe(true);
    expect(effectiveDateForMs(result.startMs)).toBe("2026-06-26");
    expect(getLogicalEndDate(result.startMs, result.endMs)).toBe("2026-06-27");
  });

  it("uses midnight reset with classic calendar-day span", () => {
    setResetMinutes(0);

    const result = resolvePeriodFromLogicalDay(
      "2026-06-26",
      "23:00:00",
      "02:00:00",
      0
    );

    expect(result.startMs).toBe(localMs(2026, 6, 26, 23, 0));
    expect(result.endMs).toBe(localMs(2026, 6, 27, 2, 0));
    expect(spansLogicalDays(result.startMs, result.endMs)).toBe(true);
    expect(effectiveDateForMs(result.startMs)).toBe("2026-06-26");
    expect(getLogicalEndDate(result.startMs, result.endMs)).toBe("2026-06-27");
  });
});

describe("periodBelongsToDay", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    setResetMinutes(0);
  });

  it("includes a zero-duration completion at day start", () => {
    const startMs = localMs(2026, 6, 26, 0, 0);
    expect(periodBelongsToDay(startMs, startMs, "2026-06-26", startMs)).toBe(
      true
    );
  });

  it("excludes a zero-duration completion at the next day start", () => {
    const nextStart = localMs(2026, 6, 27, 0, 0);
    expect(
      periodBelongsToDay(nextStart, nextStart, "2026-06-26", nextStart)
    ).toBe(false);
  });

  it("still matches timed sessions by interval overlap", () => {
    const startMs = localMs(2026, 6, 26, 23, 0);
    const endMs = localMs(2026, 6, 27, 1, 0);
    expect(periodBelongsToDay(startMs, endMs, "2026-06-26", endMs)).toBe(true);
    expect(periodBelongsToDay(startMs, endMs, "2026-06-27", endMs)).toBe(true);
  });
});
