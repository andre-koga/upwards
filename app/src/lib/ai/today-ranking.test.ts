import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RANKING_STALE_AFTER_MS,
  clearStoredRanking,
  getStoredRanking,
  isRankingStale,
  setStoredRanking,
  type StoredRanking,
} from "./today-ranking";

const T0 = new Date("2026-10-12T09:00:00.000Z").getTime();
const ranking = (over: Partial<StoredRanking> = {}): StoredRanking => ({
  date: "2026-10-12",
  generatedAt: new Date(T0).toISOString(),
  order: [
    { id: "a", reason: "Done 5 of the last 7 days" },
    { id: "b", reason: null },
  ],
  ...over,
});

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stored ranking", () => {
  it("round-trips for the same day", () => {
    setStoredRanking(ranking());
    expect(getStoredRanking("2026-10-12")).toEqual(ranking());
  });

  it("is gone the next day", () => {
    setStoredRanking(ranking());
    expect(getStoredRanking("2026-10-13")).toBeNull();
  });

  it("ignores unreadable or malformed storage", () => {
    localStorage.setItem("upwards:ai_today_order", "{nope");
    expect(getStoredRanking("2026-10-12")).toBeNull();
    localStorage.setItem(
      "upwards:ai_today_order",
      JSON.stringify({
        date: "2026-10-12",
        generatedAt: "x",
        order: [{ id: 1 }],
      })
    );
    expect(getStoredRanking("2026-10-12")).toBeNull();
  });

  it("clears", () => {
    setStoredRanking(ranking());
    clearStoredRanking();
    expect(getStoredRanking("2026-10-12")).toBeNull();
  });
});

describe("isRankingStale", () => {
  it("is fresh while recent and every open row is in it", () => {
    expect(isRankingStale(ranking(), ["a"], T0 + 60_000)).toBe(false);
    expect(isRankingStale(ranking(), ["a", "b"], T0 + 60_000)).toBe(false);
  });

  it("is stale once old", () => {
    expect(
      isRankingStale(ranking(), ["a"], T0 + RANKING_STALE_AFTER_MS + 1)
    ).toBe(true);
  });

  it("is stale when an open row is not in it", () => {
    expect(isRankingStale(ranking(), ["a", "new"], T0 + 60_000)).toBe(true);
  });

  it("is stale when the clock reads before it was made", () => {
    expect(isRankingStale(ranking(), ["a"], T0 - 60_000)).toBe(true);
  });
});
