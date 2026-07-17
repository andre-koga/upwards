import { describe, expect, it } from "vitest";
import { getHolidayName } from "@/lib/journal/holidays";
import {
  buildJournalArchiveFeed,
  journalEntryHasContent,
  journalEntryMatchesQuery,
} from "@/lib/journal/archive";
import type { JournalEntry } from "@/lib/db/types";

function makeEntry(
  overrides: Partial<JournalEntry> & Pick<JournalEntry, "entry_date">
): JournalEntry {
  return {
    id: overrides.id ?? overrides.entry_date,
    entry_date: overrides.entry_date,
    title: overrides.title ?? null,
    text_content: overrides.text_content ?? null,
    day_emoji: overrides.day_emoji ?? null,
    is_bookmarked: overrides.is_bookmarked ?? null,
    video_path: overrides.video_path ?? null,
    video_thumbnail: overrides.video_thumbnail ?? null,
    photo_paths: overrides.photo_paths ?? null,
    is_journal_complete: overrides.is_journal_complete ?? null,
    journal_entry_number: overrides.journal_entry_number ?? null,
    journal_completion_streak: overrides.journal_completion_streak ?? null,
    journal_completed_at: overrides.journal_completed_at ?? null,
    location: overrides.location ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
    synced_at: overrides.synced_at ?? null,
    deleted_at: overrides.deleted_at ?? null,
  };
}

describe("getHolidayName", () => {
  it("returns fixed US holidays", () => {
    expect(getHolidayName("2026-07-04", "en")).toBe("Independence Day");
    expect(getHolidayName("2026-12-25", "en")).toBe("Christmas Day");
  });

  it("returns Thanksgiving as the 4th Thursday of November", () => {
    expect(getHolidayName("2026-11-26", "en")).toBe("Thanksgiving");
  });

  it("returns Brazilian Independence Day in pt", () => {
    expect(getHolidayName("2026-09-07", "pt")).toBe("Independência do Brasil");
  });

  it("returns null for ordinary days", () => {
    expect(getHolidayName("2026-07-17", "en")).toBeNull();
  });
});

describe("journal archive helpers", () => {
  it("detects entries with content", () => {
    expect(
      journalEntryHasContent(makeEntry({ entry_date: "2026-01-01" }))
    ).toBe(false);
    expect(
      journalEntryHasContent(
        makeEntry({ entry_date: "2026-01-01", title: "Hello" })
      )
    ).toBe(true);
  });

  it("matches search terms across title and text", () => {
    const entry = makeEntry({
      entry_date: "2026-07-04",
      title: "Parade day",
      text_content: "Fireworks at night",
      day_emoji: "🎆",
    });
    expect(journalEntryMatchesQuery(entry, "fireworks", "en")).toBe(true);
    expect(journalEntryMatchesQuery(entry, "independence", "en")).toBe(true);
    expect(journalEntryMatchesQuery(entry, "missing", "en")).toBe(false);
  });

  it("inserts year, month, and holiday banners", () => {
    const feed = buildJournalArchiveFeed(
      [
        makeEntry({ entry_date: "2026-07-04", title: "A" }),
        makeEntry({ entry_date: "2026-06-01", title: "B" }),
        makeEntry({ entry_date: "2025-12-25", title: "C" }),
      ],
      "en"
    );
    expect(feed.map((i) => i.kind)).toEqual([
      "year",
      "month",
      "holiday",
      "entry",
      "month",
      "entry",
      "year",
      "month",
      "holiday",
      "entry",
    ]);
    expect(feed[0]).toMatchObject({ kind: "year", year: 2026 });
    expect(feed[1]).toMatchObject({ kind: "month", year: 2026, month: 7 });
    expect(feed[2]).toMatchObject({
      kind: "holiday",
      name: "Independence Day",
    });
    expect(feed[6]).toMatchObject({ kind: "year", year: 2025 });
    expect(feed[8]).toMatchObject({
      kind: "holiday",
      name: "Christmas Day",
    });
  });
});
