import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => null,
  getQueueAccountId: () => null,
  getCachedSession: () => null,
}));

import { db } from "@/lib/db";
import type { Activity, DailyEntry, JournalEntry } from "@/lib/db/types";
import { fromDateString, shiftDate, toDateString } from "@/lib/time-utils";
import { loadHomeDigest as loadDigest } from "./load-digest";

/** The items alone; the count has its own test. */
const loadHomeDigest = async (today: string) => (await loadDigest(today)).items;

const TODAY = "2026-10-14";
const day = (offset: number) =>
  toDateString(shiftDate(fromDateString(TODAY), offset));
const stamp = (date: string) => `${date}T12:00:00.000Z`;

function activity(id: string, over: Partial<Activity> = {}): Activity {
  return {
    id,
    group_id: "g",
    name: id,
    routine: "daily",
    completion_target: 1,
    archived_at: null,
    tracks_time: true,
    is_pinned: false,
    order_index: null,
    created_at: stamp(day(-30)),
    updated_at: stamp(day(-30)),
    synced_at: null,
    deleted_at: null,
    ...over,
  };
}

function entryOn(date: string, counts: Record<string, number>): DailyEntry {
  return {
    id: `d-${date}`,
    date,
    task_counts: counts,
    paused_task_ids: null,
    is_break_day: null,
    completion_notes: null,
    completion_times: null,
    created_at: stamp(date),
    updated_at: stamp(date),
    synced_at: null,
    deleted_at: null,
  };
}

function journalOn(date: string, complete = true): JournalEntry {
  return {
    id: `j-${date}`,
    entry_date: date,
    title: complete ? "A day" : null,
    text_content: "Words",
    day_emoji: complete ? "🙂" : null,
    is_bookmarked: null,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    location: null,
    created_at: stamp(date),
    updated_at: stamp(date),
    synced_at: null,
    deleted_at: null,
  };
}

beforeEach(async () => {
  await Promise.all([
    db.activities.clear(),
    db.dailyEntries.clear(),
    db.journalEntries.clear(),
    db.activityPeriods.clear(),
  ]);
});

describe("loadHomeDigest", () => {
  it("counts the habits it read, so an empty digest can mean 'nothing yet'", async () => {
    expect((await loadDigest(TODAY)).trackedHabits).toBe(0);
    await db.activities.bulkAdd([
      activity("a"),
      activity("b"),
      activity("avoid", { routine: "never" }),
    ]);
    expect((await loadDigest(TODAY)).trackedHabits).toBe(2);
  });

  it("is empty for a device with nothing on it", async () => {
    expect(await loadHomeDigest(TODAY)).toEqual([]);
  });

  it("flags a real streak not yet done today, with the streak it replayed", async () => {
    await db.activities.add(activity("run"));
    // Done on each of the 5 days before today.
    await db.dailyEntries.bulkAdd(
      [1, 2, 3, 4, 5].map((n) => entryOn(day(-n), { run: 1 }))
    );

    const items = await loadHomeDigest(TODAY);

    expect(items).toEqual([
      expect.objectContaining({
        kind: "streak-at-risk",
        activityId: "run",
        name: "run",
        doneToday: 0,
        target: 1,
      }),
    ]);
    const [item] = items;
    expect(
      item.kind === "streak-at-risk" && item.streak
    ).toBeGreaterThanOrEqual(5);
  });

  it("stays quiet once today's target is met", async () => {
    await db.activities.add(activity("run"));
    await db.dailyEntries.bulkAdd(
      [0, 1, 2, 3, 4, 5].map((n) => entryOn(day(-n), { run: 1 }))
    );
    expect(await loadHomeDigest(TODAY)).toEqual([]);
  });

  it("flags a habit done on few of the last seven days", async () => {
    await db.activities.add(activity("stretch"));
    await db.dailyEntries.bulkAdd([
      entryOn(day(-2), { stretch: 1 }),
      ...[1, 3, 4, 5, 6, 7].map((n) => entryOn(day(-n), { stretch: 0 })),
    ]);

    const items = await loadHomeDigest(TODAY);

    expect(items).toEqual([
      expect.objectContaining({
        kind: "slipping",
        activityId: "stretch",
        daysDone: 1,
        daysActive: 7,
      }),
    ]);
  });

  it("leaves out archived, deleted, unnamed and avoid habits", async () => {
    await db.activities.bulkAdd([
      activity("archived", { archived_at: stamp(day(-1)) }),
      activity("deleted", { deleted_at: stamp(day(-1)) }),
      activity("unnamed", { name: null }),
      activity("avoid", { routine: "never" }),
    ]);
    await db.dailyEntries.bulkAdd(
      [1, 2, 3, 4, 5].map((n) =>
        entryOn(day(-n), { archived: 1, deleted: 1, unnamed: 1, avoid: 1 })
      )
    );
    expect(await loadHomeDigest(TODAY)).toEqual([]);
  });

  it("carries the pin, so the action can tell a pinned habit from an open one", async () => {
    await db.activities.add(activity("run", { is_pinned: true }));
    await db.dailyEntries.bulkAdd(
      [1, 2, 3, 4].map((n) => entryOn(day(-n), { run: 1 }))
    );
    expect(await loadHomeDigest(TODAY)).toEqual([
      expect.objectContaining({ activityId: "run", pinned: true }),
    ]);
  });

  it("warns about a journal streak when today is not written", async () => {
    await db.journalEntries.bulkAdd(
      [1, 2, 3, 4].map((n) => journalOn(day(-n)))
    );
    expect(await loadHomeDigest(TODAY)).toEqual([
      { kind: "journal-streak", streak: 4 },
    ]);
  });

  it("does not count an incomplete day toward the journal streak", async () => {
    await db.journalEntries.bulkAdd([
      journalOn(day(-1)),
      journalOn(day(-2), false),
      journalOn(day(-3)),
    ]);
    // Only yesterday is a complete run; one day is not yet worth a warning.
    expect(await loadHomeDigest(TODAY)).toEqual([]);
  });

  it("stays quiet about the journal once today is written", async () => {
    await db.journalEntries.bulkAdd(
      [0, 1, 2, 3].map((n) => journalOn(day(-n)))
    );
    expect(await loadHomeDigest(TODAY)).toEqual([]);
  });
});
