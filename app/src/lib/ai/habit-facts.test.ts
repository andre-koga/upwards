import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => null,
  getQueueAccountId: () => null,
  getCachedSession: () => null,
}));
// The payload reads today from the clock; pin that, but only when it is asked
// for "now". Given a date (an activity's creation time) it must still convert
// that date, or every activity would look as if it began today.
vi.mock("@/lib/time-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/time-utils")>();
  return {
    ...original,
    todayDateString: (date?: Date) =>
      date ? original.todayDateString(date) : "2026-10-14",
  };
});

import { db } from "@/lib/db";
import type { Activity, DailyEntry } from "@/lib/db/types";
import {
  MAX_INSIGHT_ACTIVITIES,
  parseInsightRequest,
} from "../../../../supabase/functions/_shared/insight";
import { buildInsightRequest } from "./build-insight-payload";
import { loadHabitFacts } from "./habit-facts";

const TODAY = "2026-10-14";
const day = (offset: number) => {
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
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

beforeEach(async () => {
  await Promise.all([
    db.activities.clear(),
    db.dailyEntries.clear(),
    db.journalEntries.clear(),
    db.activityPeriods.clear(),
  ]);
});

describe("loadHabitFacts", () => {
  it("counts a missed day that has no record as a miss", async () => {
    await db.activities.add(activity("stretch"));
    // Done on two of the seven days. The other five have no row at all, because
    // an empty day no longer creates one.
    await db.dailyEntries.bulkAdd([
      entryOn(day(-2), { stretch: 1 }),
      entryOn(day(-6), { stretch: 1 }),
    ]);

    const [habit] = await loadHabitFacts(TODAY);

    expect(habit.figures.daysDone).toBe(2);
    expect(habit.figures.daysActive).toBe(7);
  });

  it("reads a streak as the run going into today, not zero for an unfinished today", async () => {
    await db.activities.add(activity("run"));
    await db.dailyEntries.bulkAdd(
      [1, 2, 3, 4, 5].map((n) => entryOn(day(-n), { run: 1 }))
    );

    const [habit] = await loadHabitFacts(TODAY);

    expect(habit.figures.streak).toBeGreaterThanOrEqual(5);
    expect(habit.figures.doneToday).toBe(0);
  });

  it("leaves out avoid, archived, deleted and unnamed activities", async () => {
    await db.activities.bulkAdd([
      activity("keep"),
      activity("avoid", { routine: "never" }),
      activity("archived", { archived_at: stamp(day(-1)) }),
      activity("deleted", { deleted_at: stamp(day(-1)) }),
      activity("unnamed", { name: null }),
    ]);
    expect((await loadHabitFacts(TODAY)).map((h) => h.id)).toEqual(["keep"]);
  });

  it("is empty for a device with no activities", async () => {
    expect(await loadHabitFacts(TODAY)).toEqual([]);
  });
});

describe("buildInsightRequest", () => {
  it("tells the model the same week the screen shows", async () => {
    await db.activities.add(activity("run"));
    await db.dailyEntries.bulkAdd(
      [1, 2, 3, 4, 5, 6, 7].map((n) => entryOn(day(-n), { run: 1 }))
    );

    const { payload } = await buildInsightRequest();
    const [habit] = await loadHabitFacts(TODAY);

    expect(payload.activities).toEqual([
      {
        key: "1",
        name: "run",
        targetPerDay: 1,
        completedDays: habit.figures.daysDone,
        totalDays: habit.figures.daysActive,
        streak: habit.figures.streak,
      },
    ]);
    expect(payload.activities[0].streak).toBeGreaterThanOrEqual(7);
    expect(payload.completionRate).toBe(1);
  });

  it("does not inflate the completion rate by ignoring days with no record", async () => {
    await db.activities.add(activity("run"));
    // One done day and six with no row at all: 1 of 7, not 1 of 1.
    await db.dailyEntries.add(entryOn(day(-1), { run: 1 }));

    const { payload } = await buildInsightRequest();

    expect(payload.activities[0].completedDays).toBe(1);
    expect(payload.activities[0].totalDays).toBe(7);
    expect(payload.completionRate).toBe(0.14);
  });

  it("keys each habit and keeps the ids on the device, out of the payload", async () => {
    await db.activities.bulkAdd([activity("run"), activity("read")]);

    const { payload, habits } = await buildInsightRequest();

    expect(payload.activities.map((a) => a.key)).toEqual(["1", "2"]);
    // The key-to-habit map is returned beside the payload, never inside it.
    expect(habits.map((h) => h.key)).toEqual(["1", "2"]);
    expect(new Set(habits.map((h) => h.id))).toEqual(new Set(["run", "read"]));
    const sent = JSON.stringify(payload);
    expect(sent).not.toContain('"id"');
    expect(sent).not.toContain("run-id");
    // Each key points at the habit whose figures it carries.
    for (const entry of payload.activities) {
      expect(habits.find((h) => h.key === entry.key)?.name).toBe(entry.name);
    }
  });

  it("sends no more habits than the function accepts", async () => {
    await db.activities.bulkAdd(
      Array.from({ length: MAX_INSIGHT_ACTIVITIES + 5 }, (_, i) =>
        activity(`h${i}`)
      )
    );

    const { payload, habits } = await buildInsightRequest();

    expect(payload.activities).toHaveLength(MAX_INSIGHT_ACTIVITIES);
    expect(habits).toHaveLength(MAX_INSIGHT_ACTIVITIES);
  });

  it("produces a payload the function accepts", async () => {
    await db.activities.bulkAdd([activity("run"), activity("read")]);
    await db.dailyEntries.add(entryOn(day(-1), { run: 1 }));

    const { payload } = await buildInsightRequest();

    expect(
      parseInsightRequest(JSON.parse(JSON.stringify(payload)))
    ).not.toBeNull();
  });
});
