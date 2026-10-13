import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "77777777-7777-4777-8777-777777777777" as string | null,
  deleted: [] as string[],
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => auth.userId,
  getQueueAccountId: () => auth.userId,
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-a",
}));
vi.mock("@/lib/sync/sync-scheduler", () => ({
  requestDebouncedSync: () => undefined,
}));
vi.mock("@/lib/journal/photo-storage", () => ({
  deleteJournalPhoto: async (path: string) => {
    auth.deleted.push(path);
  },
}));

import { db } from "@/lib/db";
import type { JournalEntry, JournalEntryRevision } from "@/lib/db/types";
import { naturalJournalIdForDate } from "@/lib/sync/natural-ids";
import { deletePhotosNoLongerUsed } from "./photo-cleanup";
import {
  journalRevisionsForDate,
  journalRevisionSummaries,
  restoreJournalRevision,
  sortRevisionsNewestFirst,
  summarizeRevisionsByDate,
} from "./revisions";

const DATE = "2025-03-14";
const T1 = "2026-10-01T12:00:00.000Z";
const T2 = "2026-10-05T12:00:00.000Z";

function revision(
  id: string,
  patch: Partial<JournalEntryRevision> = {}
): JournalEntryRevision {
  return {
    id,
    entry_date: DATE,
    title: "Old title",
    day_emoji: "🌧️",
    text_content: "The old words",
    photo_paths: ["u/old.jpg"],
    video_path: null,
    video_thumbnail: null,
    created_at: T1,
    updated_at: T1,
    synced_at: null,
    ...patch,
  };
}

function entry(patch: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: naturalJournalIdForDate(DATE),
    entry_date: DATE,
    title: "New title",
    day_emoji: "☀️",
    text_content: "The rewritten words",
    is_bookmarked: true,
    video_path: null,
    video_thumbnail: null,
    photo_paths: ["u/new.jpg"],
    location: {
      locations: [
        {
          displayName: "Lisbon",
          city: "Lisbon",
          state: null,
          country: "Portugal",
          countryCode: "PT",
          lat: 38.7,
          lon: -9.1,
        },
      ],
    },
    created_at: "2025-03-14T20:00:00.000Z",
    updated_at: T2,
    synced_at: null,
    deleted_at: null,
    ...patch,
  };
}

async function pendingOps(entityType: string) {
  return (await db.syncPendingOperations.toArray()).filter(
    (op) => op.entity_type === entityType
  );
}

beforeEach(async () => {
  storage.clear();
  auth.deleted = [];
  await Promise.all([
    db.journalEntries.clear(),
    db.journalEntryRevisions.clear(),
    db.syncPendingOperations.clear(),
    db.syncIssues.clear(),
  ]);
});

describe("restoreJournalRevision", () => {
  it("puts the old words and media back and leaves hearts and places alone", async () => {
    await db.journalEntries.add(entry());
    await db.journalEntryRevisions.add(revision("r1"));

    expect(await restoreJournalRevision("r1")).toBe("restored");

    const restored = await db.journalEntries.get(naturalJournalIdForDate(DATE));
    expect(restored).toMatchObject({
      title: "Old title",
      day_emoji: "🌧️",
      text_content: "The old words",
      photo_paths: ["u/old.jpg"],
      is_bookmarked: true,
    });
    expect(restored?.location?.locations[0]?.displayName).toBe("Lisbon");
    expect(restored?.updated_at > T2).toBe(true);
  });

  it("keeps what it replaces as a new version, so a restore can be undone", async () => {
    await db.journalEntries.add(entry());
    await db.journalEntryRevisions.add(revision("r1"));

    await restoreJournalRevision("r1");

    const revisions = await journalRevisionsForDate(DATE);
    expect(revisions).toHaveLength(2);
    const displaced = revisions.find((r) => r.id !== "r1")!;
    expect(displaced).toMatchObject({
      title: "New title",
      text_content: "The rewritten words",
      photo_paths: ["u/new.jpg"],
    });
    expect(await pendingOps("journal_entry_revision")).toHaveLength(1);

    // Undo: restoring the displaced version brings the rewrite back.
    expect(await restoreJournalRevision(displaced.id)).toBe("restored");
    const back = await db.journalEntries.get(naturalJournalIdForDate(DATE));
    expect(back).toMatchObject({
      title: "New title",
      text_content: "The rewritten words",
      photo_paths: ["u/new.jpg"],
    });
    expect(await db.journalEntryRevisions.count()).toBe(3);
  });

  it("queues the entry change for sync with the row's last known revision", async () => {
    await db.journalEntries.add(entry());
    await db.journalEntryRevisions.add(revision("r1"));

    await restoreJournalRevision("r1");

    const ops = await pendingOps("journal_entry");
    expect(ops).toHaveLength(1);
    expect(ops[0].base_revision).toBe(T2);
  });

  it("does nothing when the day already matches that version", async () => {
    await db.journalEntries.add(
      entry({
        title: "Old title",
        day_emoji: "🌧️",
        text_content: "The old words",
        photo_paths: ["u/old.jpg"],
      })
    );
    await db.journalEntryRevisions.add(revision("r1"));

    expect(await restoreJournalRevision("r1")).toBe("unchanged");
    expect(await db.journalEntryRevisions.count()).toBe(1);
    expect(await pendingOps("journal_entry")).toHaveLength(0);
  });

  it("reports a version that no longer exists", async () => {
    expect(await restoreJournalRevision("nope")).toBe("missing");
  });

  it("recreates the day when its row is gone", async () => {
    await db.journalEntryRevisions.add(revision("r1"));

    expect(await restoreJournalRevision("r1")).toBe("restored");

    expect(
      await db.journalEntries.get(naturalJournalIdForDate(DATE))
    ).toMatchObject({
      title: "Old title",
      is_bookmarked: false,
      deleted_at: null,
    });
    // Nothing was overwritten, so there is nothing new to keep.
    expect(await db.journalEntryRevisions.count()).toBe(1);
  });

  it("deletes no photos, and keeps the ones the displaced version uses", async () => {
    await db.journalEntries.add(entry());
    await db.journalEntryRevisions.add(revision("r1"));

    await restoreJournalRevision("r1");
    // The cleanup a later save would run for the photo the restore dropped.
    await deletePhotosNoLongerUsed(["u/new.jpg"]);

    expect(auth.deleted).toEqual([]);
  });

  it("takes the old clip's thumbnail only when the clip changes", async () => {
    await db.journalEntries.add(
      entry({ video_path: "u/clip.mp4", video_thumbnail: "thumb-now" })
    );
    await db.journalEntryRevisions.add(
      revision("r1", { video_path: "u/clip.mp4", video_thumbnail: "thumb-old" })
    );
    await restoreJournalRevision("r1");
    expect(
      (await db.journalEntries.get(naturalJournalIdForDate(DATE)))
        ?.video_thumbnail
    ).toBe("thumb-now");

    await db.journalEntryRevisions.add(
      revision("r2", { video_path: "u/other.mp4", video_thumbnail: "thumb-2" })
    );
    await restoreJournalRevision("r2");
    expect(
      (await db.journalEntries.get(naturalJournalIdForDate(DATE)))
        ?.video_thumbnail
    ).toBe("thumb-2");
  });
});

describe("listing", () => {
  it("returns a day's versions newest first and ignores other days", async () => {
    await db.journalEntryRevisions.bulkAdd([
      revision("a", { created_at: T1 }),
      revision("b", { created_at: T2 }),
      revision("c", { entry_date: "2025-03-15", created_at: T2 }),
    ]);

    expect((await journalRevisionsForDate(DATE)).map((r) => r.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("breaks equal timestamps the same way on every device", () => {
    const tied = [revision("a"), revision("b")];
    expect(sortRevisionsNewestFirst(tied).map((r) => r.id)).toEqual(["b", "a"]);
    expect(
      sortRevisionsNewestFirst([...tied].reverse()).map((r) => r.id)
    ).toEqual(["b", "a"]);
  });

  it("summarizes each day by its count and newest version", async () => {
    await db.journalEntryRevisions.bulkAdd([
      revision("a", { created_at: T1 }),
      revision("b", { created_at: T2 }),
      revision("c", { entry_date: "2025-03-15", created_at: T1 }),
    ]);

    const summaries = await journalRevisionSummaries();
    expect(summaries.get(DATE)).toEqual({ count: 2, editedAt: T2 });
    expect(summaries.get("2025-03-15")).toEqual({ count: 1, editedAt: T1 });
    expect(summaries.has("2025-03-16")).toBe(false);
    expect(summarizeRevisionsByDate([]).size).toBe(0);
  });
});
