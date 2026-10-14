import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissSuggestion,
  getDismissedSuggestions,
  suggestionId,
} from "./insight-dismissed";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  } as Storage;
});

describe("insight-dismissed", () => {
  it("starts empty", () => {
    expect(getDismissedSuggestions().size).toBe(0);
  });

  it("remembers a dismissed suggestion", () => {
    const id = suggestionId("2026-10-14T12:00:00.000Z", "2");
    expect(dismissSuggestion(id).has(id)).toBe(true);
    expect(getDismissedSuggestions().has(id)).toBe(true);
  });

  it("is per insight: the same key in a new insight is not dismissed", () => {
    dismissSuggestion(suggestionId("2026-10-14T12:00:00.000Z", "2"));
    expect(
      getDismissedSuggestions().has(
        suggestionId("2026-10-15T09:00:00.000Z", "2")
      )
    ).toBe(false);
  });

  it("keeps the list from growing without bound, newest last", () => {
    for (let i = 0; i < 60; i += 1) dismissSuggestion(`id-${i}`);
    const kept = getDismissedSuggestions();
    expect(kept.size).toBe(40);
    expect(kept.has("id-59")).toBe(true);
    expect(kept.has("id-0")).toBe(false);
  });

  it("survives corrupt storage", () => {
    storage.set("okhabit:ai_insight_dismissed", "{not json");
    expect(getDismissedSuggestions().size).toBe(0);
    expect(dismissSuggestion("a").has("a")).toBe(true);
  });
});
