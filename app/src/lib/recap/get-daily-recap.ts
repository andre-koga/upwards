import { db } from "@/lib/db";
import type { Activity, ActivityGroup, DailyEntry } from "@/lib/db/types";
import { fromDateString } from "@/lib/time-utils";

export interface RecapCompletedItem {
  activity: Activity;
  group: ActivityGroup | undefined;
  streak: number;
}

export interface RecapMissedItem {
  activity: Activity;
  group: ActivityGroup | undefined;
  previousStreak: number;
}

export interface DailyRecapData {
  date: string;
  completed: RecapCompletedItem[];
  missed: RecapMissedItem[];
  isBreakDay: boolean;
  completionRate: number;
  loginStreak: number;
  totalTrackedMs: number;
}

function isActivityCompleted(
  activity: Activity,
  entry: DailyEntry | undefined
): boolean {
  const counts = (entry?.task_counts as Record<string, number> | null) ?? {};
  const count = counts[activity.id] ?? 0;
  if (activity.routine === "never") {
    // "never slip" — success means no slip was recorded (count === 0)
    return count === 0;
  }
  if (!entry) return false;
  const target = activity.completion_target ?? 1;
  return count >= target;
}

function isActivityMissed(
  activity: Activity,
  entry: DailyEntry | undefined
): boolean {
  if (entry?.is_break_day) return false;
  const pausedIds = Array.isArray(entry?.paused_task_ids) ? entry.paused_task_ids : [];
  if (pausedIds.includes(activity.id)) return false;
  if (activity.routine === "never") {
    // "never slip" — a miss means at least one slip was recorded
    const counts = (entry?.task_counts as Record<string, number> | null) ?? {};
    return (counts[activity.id] ?? 0) > 0;
  }
  if (!entry) return true;
  return !isActivityCompleted(activity, entry);
}

/**
 * Build a recap summary for a given date using data already cached in IndexedDB.
 * Only uses locally cached streak rows — does not trigger a recompute.
 */
export async function getDailyRecap(
  date: string,
  loginStreak: number
): Promise<DailyRecapData> {
  const dateObj = fromDateString(date);

  const [entry, allActivities, allGroups, allStreakRows] = await Promise.all([
    db.dailyEntries
      .where("date")
      .equals(date)
      .filter((e) => !e.deleted_at)
      .first(),
    db.activities
      .filter((a) => !a.deleted_at)
      .toArray(),
    db.activityGroups
      .filter((g) => !g.deleted_at)
      .toArray(),
    db.activityStreaks
      .where("date")
      .equals(date)
      .filter((r) => !r.deleted_at)
      .toArray(),
  ]);

  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  const streakByActivityId = new Map(allStreakRows.map((r) => [r.activity_id, r.streak]));

  const isBreakDay = entry?.is_break_day ?? false;

  // Sum all completed activity periods for the day.
  let totalTrackedMs = 0;
  if (entry) {
    const periods = await db.activityPeriods
      .where("daily_entry_id")
      .equals(entry.id)
      .filter((p) => !p.deleted_at)
      .toArray();
    for (const p of periods) {
      if (p.start_time && p.end_time) {
        totalTrackedMs += new Date(p.end_time).getTime() - new Date(p.start_time).getTime();
      }
    }
    totalTrackedMs = Math.max(0, totalTrackedMs);
}

  // Determine which activities were active (scheduled) on this date.
  // We use a simple date-based filter: activity must not be deleted and must
  // have been created on or before this date. For full routine-aware filtering
  // we would need the status events; we approximate by checking created_at vs date.
  const dayMs = dateObj.getTime();
  const activeActivities = allActivities.filter((a) => {
    if (!a.created_at) return false;
    return new Date(a.created_at).getTime() <= dayMs + 86400000;
  });

  const completed: RecapCompletedItem[] = [];
  const missed: RecapMissedItem[] = [];

  for (const activity of activeActivities) {
    // Skip "anytime" — no daily schedule, never appears in recap
    if (activity.routine === "anytime") continue;

    const group = groupById.get(activity.group_id);
    const streak = streakByActivityId.get(activity.id) ?? 0;

    if (isActivityCompleted(activity, entry)) {
      completed.push({ activity, group, streak });
    } else if (isActivityMissed(activity, entry)) {
      missed.push({ activity, group, previousStreak: streak });
    }
  }

  const totalScheduled = completed.length + missed.length;
  const completionRate =
    totalScheduled === 0 ? 0 : Math.round((completed.length / totalScheduled) * 100);

  return {
    date,
    completed,
    missed,
    isBreakDay,
    completionRate,
    loginStreak,
    totalTrackedMs,
  };
}
