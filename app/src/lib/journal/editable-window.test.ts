import { beforeEach, describe, expect, it } from "vitest";
import {
  isActivityDateEditable,
  isJournalCalendarDateEditable,
  JOURNAL_EDITABLE_DAY_LOOKBACK,
} from "./editable-window";

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

describe("journal editable window", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "240");
  });

  it("allows today through lookback and rejects older / future days", () => {
    const now = new Date(2026, 5, 20, 12, 0, 0, 0);
    expect(isJournalCalendarDateEditable(new Date(2026, 5, 20), now)).toBe(
      true
    );
    expect(
      isJournalCalendarDateEditable(
        new Date(2026, 5, 20 - JOURNAL_EDITABLE_DAY_LOOKBACK),
        now
      )
    ).toBe(true);
    expect(
      isJournalCalendarDateEditable(
        new Date(2026, 5, 20 - JOURNAL_EDITABLE_DAY_LOOKBACK - 1),
        now
      )
    ).toBe(false);
    expect(isJournalCalendarDateEditable(new Date(2026, 5, 21), now)).toBe(
      false
    );
  });

  it("uses the day-reset boundary for activity date editability", () => {
    // 2 AM on June 20 with 4 AM reset → effective today is June 19
    const beforeReset = new Date(2026, 5, 20, 2, 0, 0, 0);
    expect(isActivityDateEditable("2026-06-19", beforeReset)).toBe(true);
    expect(isActivityDateEditable("2026-06-20", beforeReset)).toBe(false);
    expect(isActivityDateEditable("2026-06-12", beforeReset)).toBe(true);
    expect(isActivityDateEditable("2026-06-11", beforeReset)).toBe(false);
  });
});
