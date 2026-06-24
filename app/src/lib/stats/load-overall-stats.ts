import { db } from "@/lib/db";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { isActiveGroup, isHiddenGroupDefaultActivity } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadLoginStreak } from "@/lib/session/last-opened";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import {
  buildBreakDaysSet,
  buildEntriesByDateMap,
  computeCompletionTotals,
  completionRate,
  dateRangeDaysBack,
  getToday,
  isCountableRoutine,
} from "./completion";
import {
  buildAggregateHeatmap90,
  buildDailyCompletionTotals,
  buildMonthlyCompletionFromTotals,
  buildTimeOfDayBuckets,
  computeTimeByGroup,
  sumTimerMsByDate,
} from "./aggregates";
import { buildSparklineWeeks } from "./compute-activity";
import type { GroupNavSummary, MonthlyCompletionSeries, OverallStats } from "./types";

export async function loadOverallStats(): Promise<OverallStats> {
  const today = getToday();
  const weekRange = dateRangeDaysBack(7);
  const thirtyDaysAgo = shiftDate(today, -29);
  const yearAgo = shiftDate(today, -364);

  const [groups, allActivities, allDailyEntries, allPeriods, allStreakRows, latestJournal] =
    await Promise.all([
      db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
      db.activities.filter((a) => !a.deleted_at).toArray(),
      db.dailyEntries.filter((e) => !e.deleted_at).toArray(),
      db.activityPeriods.filter((p) => !p.deleted_at).toArray(),
      db.activityStreaks.filter((r) => !r.deleted_at).toArray(),
      db.journalEntries
        .filter((e) => !e.deleted_at)
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0] ?? null,
        ),
    ]);

  const activities = allActivities.filter((a) => !isHiddenGroupDefaultActivity(a));
  const countable = activities.filter(isCountableRoutine);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const breakDays = buildBreakDaysSet(allDailyEntries);
  const entriesByDate = buildEntriesByDateMap(allDailyEntries);

  const weekTotals = computeCompletionTotals(
    countable,
    entriesByDate,
    breakDays,
    weekRange.from,
    weekRange.to,
  );

  const allTimerByActivity = new Map<string, Record<string, number>>();
  const periodsByActivity = new Map<string, ActivityPeriod[]>();
  for (const p of allPeriods) {
    const list = periodsByActivity.get(p.activity_id) ?? [];
    list.push(p);
    periodsByActivity.set(p.activity_id, list);
  }
  for (const activity of activities) {
    const periods = periodsByActivity.get(activity.id) ?? [];
    allTimerByActivity.set(activity.id, sumTimerMsByDate(periods));
  }

  let weekTrackedMs = 0;
  for (const timerByDate of allTimerByActivity.values()) {
    let cur = weekRange.from;
    while (cur <= weekRange.to) {
      weekTrackedMs += timerByDate[toDateString(cur)] ?? 0;
      cur = shiftDate(cur, 1);
    }
  }

  const latestStreakPerActivity = new Map<string, number>();
  for (const row of [...allStreakRows].sort((a, b) => b.date.localeCompare(a.date))) {
    if (!latestStreakPerActivity.has(row.activity_id)) {
      latestStreakPerActivity.set(row.activity_id, row.streak);
    }
  }
  const bestCurrentHabitStreak = Math.max(0, ...latestStreakPerActivity.values());

  const dailyTotalsYear = buildDailyCompletionTotals(
    countable,
    entriesByDate,
    breakDays,
    yearAgo,
    today,
  );
  const monthlyCompletion = buildMonthlyCompletionFromTotals(dailyTotalsYear);
  const monthlyCompletionByGroup: MonthlyCompletionSeries[] = groups
    .map((group) => {
      const groupActivities = activities.filter(
        (a) => a.group_id === group.id && isCountableRoutine(a),
      );
      const dailyTotals = buildDailyCompletionTotals(
        groupActivities,
        entriesByDate,
        breakDays,
        yearAgo,
        today,
      );
      return {
        id: group.id,
        label: group.name,
        color: group.color || DEFAULT_GROUP_COLOR,
        points: buildMonthlyCompletionFromTotals(dailyTotals),
      };
    })
    .filter((series) => series.points.some((p) => p.rate !== null));
  const consistencyHeatmap90 = buildAggregateHeatmap90(countable, entriesByDate, breakDays);
  const timeByGroup30d = computeTimeByGroup(
    activities,
    groupById,
    allTimerByActivity,
    thirtyDaysAgo,
    today,
  );

  const groupSummaries: GroupNavSummary[] = groups.map((group) => {
    const groupActivities = activities.filter(
      (a) => a.group_id === group.id && isCountableRoutine(a),
    );
    const totals30 = computeCompletionTotals(
      groupActivities,
      entriesByDate,
      breakDays,
      thirtyDaysAgo,
      today,
    );

    const sparklineFrom = shiftDate(today, -27);
    const sparklineRates: number[] = [];
    let cur = sparklineFrom;
    while (cur <= today) {
      const dayTotals = computeCompletionTotals(
        groupActivities,
        entriesByDate,
        breakDays,
        cur,
        cur,
      );
      sparklineRates.push(completionRate(dayTotals.completed, dayTotals.scheduled) ?? 0);
      cur = shiftDate(cur, 1);
    }

    return {
      group,
      habitCount: activities.filter((a) => a.group_id === group.id && !a.completed_at).length,
      completionRate30d: completionRate(totals30.completed, totals30.scheduled),
      sparklineRates,
    };
  });

  return {
    weekCompletionRate: completionRate(weekTotals.completed, weekTotals.scheduled),
    weekWins: weekTotals.completed,
    weekScheduled: weekTotals.scheduled,
    weekTrackedMs,
    loginStreak: loadLoginStreak(),
    journalStreak: latestJournal?.journal_completion_streak ?? null,
    bestCurrentHabitStreak,
    consistencyHeatmap90,
    monthlyCompletion,
    monthlyCompletionByGroup,
    timeByGroup30d,
    timeOfDayBuckets: buildTimeOfDayBuckets(allPeriods),
    groups: groupSummaries,
  };
}
