import { db } from "@/lib/db";
import { loadRankRequest } from "@/lib/ai/build-rank-request";
import type { DigestHabit } from "@/lib/home/digest";
import { computeActivityStreaksForDate } from "@/lib/streak-utils";
import { fromDateString, shiftDate, toDateString } from "@/lib/time-utils";

/**
 * One account of the last week's habits, read from this device, shared by
 * everything that describes it: Home's digest, the figures sent to the AI for an
 * insight, and the ordering on Today. They read the same numbers, so the screen
 * and the model never tell two different stories about the same week.
 *
 * - The window is the seven full days before `today`, counting a day only when
 *   the habit was due and the person was not on a break. A missed day with no
 *   record still counts as a miss: daily-entry rows are no longer created empty,
 *   so counting only rows would hide every day nothing was done.
 * - A streak is the run going into today, replayed as of yesterday. An
 *   unfinished today would otherwise count as a loss and read as zero.
 * - Avoid ("never") habits are left out: they have no action to do or miss.
 */
export async function loadHabitFacts(today: string): Promise<DigestHabit[]> {
  const todayDate = fromDateString(today);

  const [activities, todayEntry] = await Promise.all([
    db.activities
      .filter(
        (a) =>
          !a.archived_at &&
          !a.deleted_at &&
          Boolean(a.name?.trim()) &&
          a.routine !== "never"
      )
      .toArray(),
    db.dailyEntries
      .where("date")
      .equals(today)
      .filter((entry) => !entry.deleted_at)
      .first(),
  ]);
  if (activities.length === 0) return [];

  // Noon keeps a day boundary out of the replay.
  const streaks = await computeActivityStreaksForDate(
    activities,
    new Date(`${toDateString(shiftDate(todayDate, -1))}T12:00:00`)
  );
  const candidates = activities.map((a) => ({ ...a, name: a.name as string }));
  const request = await loadRankRequest({
    candidates,
    today,
    todayCounts: todayEntry?.task_counts ?? {},
    streaks,
  });

  // `loadRankRequest` keys its items by position, in the order given.
  return request.items.map((item, index) => ({
    id: candidates[index].id,
    name: item.name,
    pinned: candidates[index].is_pinned === true,
    figures: {
      type: item.type,
      target: item.target,
      doneToday: item.doneToday,
      daysDone: item.daysDone,
      daysActive: item.daysActive,
      streak: item.streak,
    },
  }));
}
