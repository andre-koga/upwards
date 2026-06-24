import { db } from "@/lib/db";
import type { ActivityPeriod } from "@/lib/db/types";
import { toDateString } from "@/lib/time-utils";
import {
  buildBreakDaysSet,
  buildEntriesByDateMap,
  computeCompletionTotals,
  completionRate,
  dateRangeDaysBack,
  isCountableRoutine,
} from "./completion";
import { computeMonthlyCompletionRates } from "./compute-activity";
import { buildTimeOfDayBuckets } from "./aggregates";
import { loadActivityStats } from "./load-activity-stats";
import type { ActivityExtendedStats, ActivityRecords, SessionLogEntry } from "./types";

function computeRecords(
  stats: Awaited<ReturnType<typeof loadActivityStats>>,
  periods: ActivityPeriod[],
  monthlyPoints: { label: string; rate: number | null }[],
): ActivityRecords {
  let busiestDayMs = 0;
  let busiestDayStr: string | null = null;
  for (const [dateStr, ms] of Object.entries(stats.timerByDate)) {
    if (ms > busiestDayMs) {
      busiestDayMs = ms;
      busiestDayStr = dateStr;
    }
  }

  let bestMonthRate: number | null = null;
  let bestMonthLabel: string | null = null;
  for (const p of monthlyPoints) {
    if (p.rate !== null && (bestMonthRate === null || p.rate > bestMonthRate)) {
      bestMonthRate = p.rate;
      bestMonthLabel = p.label;
    }
  }

  let totalTrackedMs = 0;
  for (const p of periods) {
    if (p.deleted_at || !p.end_time) continue;
    totalTrackedMs += Math.max(
      0,
      new Date(p.end_time).getTime() - new Date(p.start_time).getTime(),
    );
  }

  return {
    longestStreak: stats.bestStreak,
    bestMonthRate,
    bestMonthLabel,
    busiestDayMs,
    busiestDayStr,
    totalTrackedMs,
  };
}

export async function loadActivityExtendedStats(
  activityId: string,
  groupId: string,
): Promise<ActivityExtendedStats | null> {
  const [base, activity, allDailyEntries, allPeriods, groupActivities] =
    await Promise.all([
      loadActivityStats(activityId),
      db.activities.get(activityId),
      db.dailyEntries.filter((e) => !e.deleted_at).toArray(),
      db.activityPeriods
        .where("activity_id")
        .equals(activityId)
        .filter((p) => !p.deleted_at)
        .toArray(),
      db.activities
        .filter((a) => a.group_id === groupId && !a.deleted_at)
        .toArray(),
    ]);

  if (!activity) return null;

  const monthlyPoints = computeMonthlyCompletionRates(base);

  const breakDays = buildBreakDaysSet(allDailyEntries);
  const entriesByDate = buildEntriesByDateMap(allDailyEntries);

  const ninetyRange = dateRangeDaysBack(90);
  const groupCountable = groupActivities.filter(isCountableRoutine);
  const groupTotals90 = computeCompletionTotals(
    groupCountable,
    entriesByDate,
    breakDays,
    ninetyRange.from,
    ninetyRange.to,
  );
  const activityTotals90 = computeCompletionTotals(
    isCountableRoutine(activity) ? [activity] : [],
    entriesByDate,
    breakDays,
    ninetyRange.from,
    ninetyRange.to,
  );

  const sessions: SessionLogEntry[] = allPeriods
    .filter((p) => p.end_time)
    .map((p) => ({
      id: p.id,
      dateStr: toDateString(new Date(p.start_time)),
      startTime: p.start_time,
      durationMs: Math.max(
        0,
        new Date(p.end_time!).getTime() - new Date(p.start_time).getTime(),
      ),
    }))
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const timeOfDayBuckets = buildTimeOfDayBuckets(allPeriods);

  return {
    ...base,
    records: computeRecords(base, allPeriods, monthlyPoints),
    sessions,
    timeOfDayBuckets,
    groupCompletionRate90d: completionRate(groupTotals90.completed, groupTotals90.scheduled),
    activityCompletionRate90d: completionRate(
      activityTotals90.completed,
      activityTotals90.scheduled,
    ),
  };
}
