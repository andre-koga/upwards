import { beforeEach, describe, expect, it } from "vitest";
import type { JournalEntry } from "@/lib/db/types";
import {
  journalEntryFieldsHaveContent,
  mergeJournalEntryDuplicates,
  pickPreferredJournalEntry,
} from "./dedupe-by-date";

function makeEntry(
  overrides: Partial<JournalEntry> & Pick<JournalEntry, "id" | "entry_date">
): JournalEntry {
  return {
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
    created_at: overrides.created_at ?? "2026-08-25T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-08-25T10:00:00.000Z",
    synced_at: overrides.synced_at ?? null,
    deleted_at: overrides.deleted_at ?? null,
    id: overrides.id,
    entry_date: overrides.entry_date,
  };
}

describe("pickPreferredJournalEntry", () => {
  it("prefers the entry with real journal content over an empty duplicate", () => {
    const empty = makeEntry({
      id: "empty",
      entry_date: "2026-08-25",
      updated_at: "2026-08-25T12:00:00.000Z",
    });
    const filled = makeEntry({
      id: "filled",
      entry_date: "2026-08-25",
      title: "Day note",
      text_content: "Wrote this on the other phone",
      updated_at: "2026-08-25T11:00:00.000Z",
      synced_at: "2026-08-25T11:00:00.000Z",
    });

    expect(pickPreferredJournalEntry([empty, filled])?.id).toBe("filled");
  });

  it("honors preferredId when richness is equal", () => {
    const a = makeEntry({
      id: "a",
      entry_date: "2026-08-25",
      title: "Same",
    });
    const b = makeEntry({
      id: "b",
      entry_date: "2026-08-25",
      title: "Same",
    });

    expect(pickPreferredJournalEntry([a, b], "a")?.id).toBe("a");
    expect(pickPreferredJournalEntry([a, b], "b")?.id).toBe("b");
  });
});

describe("mergeJournalEntryDuplicates", () => {
  it("fills missing text from the duplicate row", () => {
    const winner = makeEntry({
      id: "winner",
      entry_date: "2026-08-25",
      title: "Winner",
    });
    const loser = makeEntry({
      id: "loser",
      entry_date: "2026-08-25",
      text_content: "Recovered body",
      day_emoji: "🌞",
      is_bookmarked: true,
    });

    expect(mergeJournalEntryDuplicates(winner, loser)).toMatchObject({
      id: "winner",
      title: "Winner",
      text_content: "Recovered body",
      day_emoji: "🌞",
      is_bookmarked: true,
    });
  });
});

describe("journalEntryFieldsHaveContent", () => {
  it("treats bookmark-only saves as meaningful", () => {
    expect(
      journalEntryFieldsHaveContent({
        title: null,
        text_content: null,
        day_emoji: null,
        video_path: null,
        photo_paths: null,
        location: null,
        is_bookmarked: true,
      })
    ).toBe(true);
  });

  it("rejects completely empty drafts", () => {
    expect(
      journalEntryFieldsHaveContent({
        title: null,
        text_content: null,
        day_emoji: null,
        video_path: null,
        photo_paths: null,
        location: null,
        is_bookmarked: false,
      })
    ).toBe(false);
  });
});
