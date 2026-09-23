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
});
