import { beforeEach, describe, expect, it } from "vitest";
import type { JournalEntry } from "@/lib/db/types";
import {
  journalEntryFieldsHaveContent,
  loserContentWasAbsorbed,
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

  it("keeps both sides when both wrote prose for the same day", () => {
    // The core bug. Duplicate rows for one date come from the guest -> signed-in id
    // divergence, so both sides are routinely real writing from the same day. The
    // loser's words were silently discarded, with no conflict recorded and no copy
    // kept anywhere.
    const winner = makeEntry({
      id: "winner",
      entry_date: "2026-08-25",
      text_content: "Wrote this on my phone",
    });
    const loser = makeEntry({
      id: "loser",
      entry_date: "2026-08-25",
      text_content: "Wrote something completely different on my laptop",
    });

    const merged = mergeJournalEntryDuplicates(winner, loser);

    expect(merged.text_content).toContain("Wrote this on my phone");
    expect(merged.text_content).toContain(
      "Wrote something completely different on my laptop"
    );
  });

  it("does not duplicate text that is identical or already contained", () => {
    const winner = makeEntry({
      id: "winner",
      entry_date: "2026-08-25",
      text_content: "Morning run, then groceries.",
    });

    expect(
      mergeJournalEntryDuplicates(
        winner,
        makeEntry({
          id: "same",
          entry_date: "2026-08-25",
          text_content: "Morning run, then groceries.",
        })
      ).text_content
    ).toBe("Morning run, then groceries.");

    // A partial sync often leaves the shorter prefix behind; appending it would
    // read as a stutter.
    expect(
      mergeJournalEntryDuplicates(
        winner,
        makeEntry({
          id: "prefix",
          entry_date: "2026-08-25",
          text_content: "Morning run",
        })
      ).text_content
    ).toBe("Morning run, then groceries.");
  });

  it("keeps a video and its thumbnail together", () => {
    // Merging the two fields independently could pair the winner's thumbnail with
    // the loser's video, leaving a thumbnail pointing at a file that is not there.
    const winner = makeEntry({
      id: "winner",
      entry_date: "2026-08-25",
      video_thumbnail: "thumb-winner.jpg",
    });
    const loser = makeEntry({
      id: "loser",
      entry_date: "2026-08-25",
      video_path: "video-loser.mp4",
      video_thumbnail: "thumb-loser.jpg",
    });

    const merged = mergeJournalEntryDuplicates(winner, loser);
    expect(merged.video_path).toBe("video-loser.mp4");
    expect(merged.video_thumbnail).toBe("thumb-loser.jpg");
  });
});

describe("loserContentWasAbsorbed", () => {
  it("confirms a fully merged duplicate is safe to retire", () => {
    const loser = makeEntry({
      id: "loser",
      entry_date: "2026-08-25",
      text_content: "Body",
      photo_paths: ["a.jpg"],
    });
    const merged = mergeJournalEntryDuplicates(
      makeEntry({ id: "winner", entry_date: "2026-08-25", title: "Title" }),
      loser
    );

    expect(loserContentWasAbsorbed(merged, loser)).toBe(true);
  });

  it("refuses when the loser holds a second emoji the merge could not take", () => {
    // Production holds 54 journal tombstones, 53 with text and 49 with media, all
    // machine-written — there is no user-facing journal delete. This check is the
    // difference between deduplicating and deleting.
    const loser = makeEntry({
      id: "loser",
      entry_date: "2026-08-25",
      day_emoji: "🌧️",
    });
    const merged = mergeJournalEntryDuplicates(
      makeEntry({ id: "winner", entry_date: "2026-08-25", day_emoji: "🌞" }),
      loser
    );

    expect(merged.day_emoji).toBe("🌞");
    expect(loserContentWasAbsorbed(merged, loser)).toBe(false);
  });

  it("refuses when the loser holds a second video", () => {
    const loser = makeEntry({
      id: "loser",
      entry_date: "2026-08-25",
      video_path: "loser.mp4",
    });
    const merged = mergeJournalEntryDuplicates(
      makeEntry({
        id: "winner",
        entry_date: "2026-08-25",
        video_path: "winner.mp4",
      }),
      loser
    );

    expect(loserContentWasAbsorbed(merged, loser)).toBe(false);
  });

  it("confirms when both sides' prose was concatenated", () => {
    const loser = makeEntry({
      id: "loser",
      entry_date: "2026-08-25",
      text_content: "Laptop text",
    });
    const merged = mergeJournalEntryDuplicates(
      makeEntry({
        id: "winner",
        entry_date: "2026-08-25",
        text_content: "Phone text",
      }),
      loser
    );

    expect(loserContentWasAbsorbed(merged, loser)).toBe(true);
  });

  it("confirms for an empty duplicate, which is the common case", () => {
    const loser = makeEntry({ id: "loser", entry_date: "2026-08-25" });
    const merged = makeEntry({
      id: "winner",
      entry_date: "2026-08-25",
      text_content: "Real content",
    });

    expect(loserContentWasAbsorbed(merged, loser)).toBe(true);
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
