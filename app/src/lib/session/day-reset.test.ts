import { beforeEach, describe, expect, it } from "vitest";
import {
  DAY_RESET_OPTIONS,
  formatResetMinutes,
  getDayResetMinutes,
  getEffectiveToday,
  getNextResetTime,
  setDayResetMinutes,
} from "./day-reset";

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

describe("day-reset", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
  });

  it("defaults to 4 AM (240 minutes) when unset or invalid", () => {
    expect(getDayResetMinutes()).toBe(240);
    localStorage.setItem("okhabit:day_reset_minutes", "not-a-number");
    expect(getDayResetMinutes()).toBe(240);
    localStorage.setItem("okhabit:day_reset_minutes", "999");
    expect(getDayResetMinutes()).toBe(240);
  });

  it("clamps persisted reset minutes to 0–480", () => {
    setDayResetMinutes(-10);
    expect(getDayResetMinutes()).toBe(0);
    setDayResetMinutes(500);
    expect(getDayResetMinutes()).toBe(480);
    setDayResetMinutes(150.6);
    expect(getDayResetMinutes()).toBe(151);
  });

  it("keeps the previous calendar day before the reset boundary", () => {
    setDayResetMinutes(240); // 4 AM
    const beforeReset = new Date(2026, 5, 15, 3, 59, 0, 0);
    const afterReset = new Date(2026, 5, 15, 4, 0, 0, 0);
    expect(getEffectiveToday(beforeReset)).toBe("2026-06-14");
    expect(getEffectiveToday(afterReset)).toBe("2026-06-15");
  });

  it("uses the calendar day when reset is midnight", () => {
    setDayResetMinutes(0);
    const early = new Date(2026, 5, 15, 0, 30, 0, 0);
    expect(getEffectiveToday(early)).toBe("2026-06-15");
  });

  it("schedules the next reset on the following day after the boundary", () => {
    setDayResetMinutes(300); // 5 AM
    const after = new Date(2026, 5, 15, 10, 0, 0, 0);
    const next = getNextResetTime(after);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(5);
    expect(next.getMinutes()).toBe(0);
  });

  it("schedules today's reset when still before the boundary", () => {
    setDayResetMinutes(300);
    const before = new Date(2026, 5, 15, 2, 0, 0, 0);
    const next = getNextResetTime(before);
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(5);
  });

  it("formats reset labels and exposes hourly options", () => {
    expect(formatResetMinutes(0)).toBe("Midnight");
    expect(formatResetMinutes(150)).toBe("2:30 AM");
    expect(formatResetMinutes(480)).toBe("8:00 AM");
    expect(DAY_RESET_OPTIONS).toHaveLength(9);
    expect(DAY_RESET_OPTIONS[0]).toEqual({ minutes: 0, label: "Midnight" });
    expect(DAY_RESET_OPTIONS[4]).toEqual({ minutes: 240, label: "4:00 AM" });
  });
});
