import { beforeEach, describe, expect, it } from "vitest";
import {
  getCachedInsight,
  isCacheFresh,
  setCachedInsight,
} from "./insight-cache";

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

describe("insight-cache", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
  });

  it("returns null when nothing is cached", () => {
    expect(getCachedInsight()).toBeNull();
    expect(isCacheFresh(null, "fp")).toBe(false);
  });

  it("round-trips a cached insight", () => {
    setCachedInsight({
      generatedAt: new Date().toISOString(),
      fingerprint: "fp-1",
      summary: "You're doing great",
      recommendations: ["Sleep earlier"],
    });
    expect(getCachedInsight()).toEqual({
      generatedAt: expect.any(String),
      fingerprint: "fp-1",
      summary: "You're doing great",
      recommendations: ["Sleep earlier"],
    });
  });

  it("is fresh only when the fingerprint matches and it's under 24h old", () => {
    const cache = {
      generatedAt: new Date().toISOString(),
      fingerprint: "fp-1",
      summary: "s",
      recommendations: [],
    };
    expect(isCacheFresh(cache, "fp-1")).toBe(true);
    expect(isCacheFresh(cache, "fp-2")).toBe(false);

    const stale = {
      ...cache,
      generatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    };
    expect(isCacheFresh(stale, "fp-1")).toBe(false);
  });

  it("ignores malformed cache payloads", () => {
    localStorage.setItem("okhabit:ai_insight_cache", "not json");
    expect(getCachedInsight()).toBeNull();
    localStorage.setItem(
      "okhabit:ai_insight_cache",
      JSON.stringify({ summary: "missing other fields" })
    );
    expect(getCachedInsight()).toBeNull();
  });

  it("round-trips suggestions tied to a habit", () => {
    const suggestions = [
      {
        key: "1",
        activityId: "id-run",
        name: "Run",
        text: "Shoes by the door.",
      },
    ];
    setCachedInsight({
      generatedAt: new Date().toISOString(),
      fingerprint: "fp-2",
      summary: "Steady.",
      recommendations: [],
      suggestions,
    });
    expect(getCachedInsight()?.suggestions).toEqual(suggestions);
  });

  it("still reads an insight cached before suggestions were tied to a habit", () => {
    localStorage.setItem(
      "okhabit:ai_insight_cache",
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        fingerprint: "old",
        summary: "Old.",
        recommendations: ["Sleep earlier"],
      })
    );
    const cached = getCachedInsight();
    expect(cached?.recommendations).toEqual(["Sleep earlier"]);
    expect(cached?.suggestions).toBeUndefined();
  });

  it("drops a malformed suggestion without losing the insight", () => {
    localStorage.setItem(
      "okhabit:ai_insight_cache",
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        fingerprint: "fp",
        summary: "Fine.",
        recommendations: [],
        suggestions: [
          { key: "1", activityId: "a", name: "Run", text: "Good." },
          { key: "2", text: "No habit." },
          "nope",
        ],
      })
    );
    expect(getCachedInsight()?.suggestions).toEqual([
      { key: "1", activityId: "a", name: "Run", text: "Good." },
    ]);
  });
});
