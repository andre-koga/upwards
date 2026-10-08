import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getCachedUserId: () => "user-1" }));

import { db } from "@/lib/db";
import { naturalJournalId } from "@/lib/sync/natural-ids";
import { journalEntryForDate } from "./entry-for-date";

const DATE = "2026-01-01";

function entry(
  id: string,
  updatedAt: string,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    entry_date: DATE,
    title: null,
    text_content: id,
    day_emoji: null,
    is_bookmarked: null,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    location: null,
    created_at: updatedAt,
    updated_at: updatedAt,
    synced_at: updatedAt,
    deleted_at: null,
    ...extra,
  };
}

describe("journalEntryForDate", () => {
  beforeEach(async () => {
    await db.journalEntries.clear();
  });

  it("prefers the natural id over a stale copy, even an edited one", async () => {
    const natural = naturalJournalId("user-1", DATE);
    await db.journalEntries.bulkPut([
      entry(natural, "2026-10-01T00:00:00.000Z"),
      entry("old-id", "2026-10-05T00:00:00.000Z"),
    ]);
    expect((await journalEntryForDate(DATE))?.id).toBe(natural);
  });

  it("falls back to the latest live row, ignoring tombstones", async () => {
    await db.journalEntries.bulkPut([
      entry("a", "2026-10-01T00:00:00.000Z"),
      entry("b", "2026-10-02T00:00:00.000Z"),
      entry("c", "2026-10-03T00:00:00.000Z", {
        deleted_at: "2026-10-03T00:00:00.000Z",
      }),
    ]);
    expect((await journalEntryForDate(DATE))?.id).toBe("b");
    expect(await db.journalEntries.count()).toBe(3);
  });

  it("returns null for an empty day", async () => {
    expect(await journalEntryForDate(DATE)).toBeNull();
  });
});
