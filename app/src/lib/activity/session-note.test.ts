import { describe, expect, it } from "vitest";
import { SESSION_NOTE_MAX_LENGTH, normalizeSessionNote } from "./session-note";

describe("normalizeSessionNote", () => {
  it("returns null for empty or whitespace-only text", () => {
    expect(normalizeSessionNote(null)).toBeNull();
    expect(normalizeSessionNote(undefined)).toBeNull();
    expect(normalizeSessionNote("")).toBeNull();
    expect(normalizeSessionNote("   ")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSessionNote("  walked the dog  ")).toBe("walked the dog");
  });

  it("caps notes at 200 characters", () => {
    const tooLong = "a".repeat(SESSION_NOTE_MAX_LENGTH + 25);
    const normalized = normalizeSessionNote(tooLong);
    expect(normalized).toHaveLength(SESSION_NOTE_MAX_LENGTH);
    expect(normalized).toBe("a".repeat(SESSION_NOTE_MAX_LENGTH));
  });
});
