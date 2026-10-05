import { describe, expect, it } from "vitest";
import { isJournalEntryComplete, journalStreakEndingOn } from "./streak";

const full = {
  day_emoji: "🙂",
  title: "A day",
  text_content: "Went well.",
};

describe("isJournalEntryComplete", () => {
  it("needs an emoji, a title, and text", () => {
    expect(isJournalEntryComplete(full)).toBe(true);
    expect(isJournalEntryComplete({ ...full, day_emoji: null })).toBe(false);
    expect(isJournalEntryComplete({ ...full, title: "  " })).toBe(false);
    expect(isJournalEntryComplete({ ...full, text_content: "" })).toBe(false);
  });

  it("ignores deleted entries", () => {
    expect(
      isJournalEntryComplete({ ...full, deleted_at: "2026-01-01T00:00:00Z" })
    ).toBe(false);
  });
});

describe("journalStreakEndingOn", () => {
  const days = (...dates: string[]) => new Set(dates);

  it("counts consecutive complete days ending on the date", () => {
    const complete = days("2026-03-01", "2026-03-02", "2026-03-03");
    expect(journalStreakEndingOn("2026-03-03", complete)).toBe(3);
    expect(journalStreakEndingOn("2026-03-02", complete)).toBe(2);
  });

  it("is zero when the date itself is not complete", () => {
    expect(journalStreakEndingOn("2026-03-04", days("2026-03-03"))).toBe(0);
  });

  it("stops at the first gap", () => {
    const complete = days("2026-03-01", "2026-03-03", "2026-03-04");
    expect(journalStreakEndingOn("2026-03-04", complete)).toBe(2);
  });

  it("heals when a missed day is backfilled", () => {
    const before = days("2026-03-01", "2026-03-03");
    expect(journalStreakEndingOn("2026-03-03", before)).toBe(1);
    const after = days("2026-03-01", "2026-03-02", "2026-03-03");
    expect(journalStreakEndingOn("2026-03-03", after)).toBe(3);
  });

  it("walks across month and year boundaries", () => {
    const complete = days("2025-12-31", "2026-01-01", "2026-01-02");
    expect(journalStreakEndingOn("2026-01-02", complete)).toBe(3);
  });
});
