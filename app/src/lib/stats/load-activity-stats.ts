import { db } from "@/lib/db";
import type { ActivityPeriod, DailyEntry } from "@/lib/db/types";
import { computeCompoundScore, computeCompoundScoreSeries } from "@/lib/activity";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { effectiveDateForMs } from "@/lib/activity/period-day-utils";
import { isNeverRoutine } from "@/lib/activity/never-task";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import {
  buildActivityCompletionByDate,
  buildBreakDaysSet,
  buildEntriesByDateMap,
} from "./completion";
import type { ActivityStats } from "./types";

export async function loadActivityStats(activityId: string): Promise<ActivityStats> {
  const nowMs = Date.now();
  const todayStr = getEffectiveToday();
  const today = startOfDay(new Date(todayStr + "T00:00:00"));

  const [activity, periods, openPeriods, streakRows, allDailyEntries] =
    await Promise.all([
      db.activities.get(activityId),
      db.activityPeriods
        .where("activity_id")
        .equals(activityId)
        .filter((p) => !p.deleted_at && !!p.end_time)
        .toArray() as Promise<ActivityPeriod[]>,
      db.activityPeriods
        .where("activity_id")
        .equals(activityId)
        .filter((p) => !p.deleted_at && !p.end_time)
        .toArray() as Promise<ActivityPeriod[]>,
      db.activityStreaks
        .where("activity_id")
        .equals(activityId)
        .filter((r) => !r.deleted_at)
        .toArray(),
      db.dailyEntries.filter((e) => !e.deleted_at).toArray(),
    ]);

  const allPeriods = [...periods, ...openPeriods];
  const isNever = isNeverRoutine(activity);
  const hasRoutine = !!activity && activity.routine !== "anytime";
  const createdAt = activity?.created_at
    ? startOfDay(new Date(getEffectiveToday(new Date(activity.created_at)) + "T00:00:00"))
    : today;
  const createdAtStr = toDateString(createdAt);

  const sortedStreakRows = [...streakRows].sort((a, b) => b.date.localeCompare(a.date));
  const currentStreak = sortedStreakRows[0]?.streak ?? 0;
  const bestStreak = streakRows.reduce((best, r) => Math.max(best, r.streak), 0);

  const timerByDate: Record<string, number> = {};
  for (const p of allPeriods) {
    const startMs = new Date(p.start_time).getTime();
    const endMs = p.end_time ? new Date(p.end_time).getTime() : nowMs;
    const durationMs = Math.max(0, endMs - startMs);
    const dateStr = effectiveDateForMs(startMs);
    timerByDate[dateStr] = (timerByDate[dateStr] ?? 0) + durationMs;
  }

  const breakDays = buildBreakDaysSet(allDailyEntries);
  const entriesByDate = buildEntriesByDateMap(allDailyEntries);

  let completionByDate: Record<string, import("./types").DayStatus> = {};
  let compoundScore: number | null = null;
  let compoundScoreSeries90d: import("@/lib/activity").CompoundScorePoint[] | undefined;

  if (activity && hasRoutine) {
    completionByDate = buildActivityCompletionByDate(
      activity,
      entriesByDate,
      breakDays,
      createdAt,
      today,
    );
    compoundScore = computeCompoundScore(activity, entriesByDate, breakDays, createdAt, today);
    const ninetyDaysAgo = shiftDate(today, -89);
    compoundScoreSeries90d = computeCompoundScoreSeries(
      activity,
      entriesByDate,
      breakDays,
      createdAt,
      ninetyDaysAgo,
      today,
    );
  }

  return {
    activityId,
    isNever,
    hasTimer: allPeriods.length > 0,
    hasRoutine,
    currentStreak,
    bestStreak,
    createdAtStr,
    timerByDate,
    completionByDate,
    breakDateStrs: breakDays,
    compoundScore,
    compoundScoreSeries90d,
  };
}

export async function loadBulkDailyEntries(): Promise<DailyEntry[]> {
  return db.dailyEntries.filter((e) => !e.deleted_at).toArray();
}
