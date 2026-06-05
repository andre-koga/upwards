import { db } from "@/lib/db";
import type { Activity, ActivityGroup, DailyEntry } from "@/lib/db/types";
import {
  shouldShowActivity,
  buildActivityEventsByEntityId,
  buildGroupEventsByEntityId,
  loadAllActivityStatusEvents,
  loadAllGroupStatusEvents,
} from "@/lib/activity";
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
 * Only includes habits that would have appeared in For Today on that date.
 */
export async function getDailyRecap(
  date: string,
  loginStreak: number
): Promise<DailyRecapData> {
  const dateObj = fromDateString(date);

  const [
    entry,
    allActivities,
    allGroups,
    allStreakRows,
    activityStatusEvents,
    groupStatusEvents,
  ] = await Promise.all([
    db.dailyEntries
      .where("date")
      .equals(date)
      .filter((e) => !e.deleted_at)
      .first(),
    db.activities.toArray(),
    db.activityGroups.toArray(),
    db.activityStreaks
      .where("date")
      .equals(date)
      .filter((r) => !r.deleted_at)
      .toArray(),
    loadAllActivityStatusEvents(),
    loadAllGroupStatusEvents(),
  ]);

  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  const streakByActivityId = new Map(allStreakRows.map((r) => [r.activity_id, r.streak]));
  const temporal = {
    viewDate: dateObj,
    activityEventsById: buildActivityEventsByEntityId(activityStatusEvents),
    groupEventsById: buildGroupEventsByEntityId(groupStatusEvents),
  };

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

  const forTodayActivities = allActivities.filter((activity) => {
    const group = groupById.get(activity.group_id);
    return shouldShowActivity(activity, dateObj, group, temporal);
  });

  const completed: RecapCompletedItem[] = [];
  const missed: RecapMissedItem[] = [];

  for (const activity of forTodayActivities) {
    const group = groupById.get(activity.group_id);
    const streak = streakByActivityId.get(activity.id) ?? 0;

    if (isActivityCompleted(activity, entry)) {
      completed.push({ activity, group, streak });
    } else if (isActivityMissed(activity, entry)) {
      missed.push({ activity, group, previousStreak: streak });
    }
  }

  const pausedIds = Array.isArray(entry?.paused_task_ids) ? entry.paused_task_ids : [];
  const rateActivities = forTodayActivities.filter(
    (activity) => activity.routine !== "never" && !pausedIds.includes(activity.id)
  );
  const completedForRate = rateActivities.filter((activity) =>
    isActivityCompleted(activity, entry)
  ).length;
  const completionRate =
    rateActivities.length === 0
      ? 0
      : Math.round((completedForRate / rateActivities.length) * 100);

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
