import { db } from "@/lib/db";
import type { Activity } from "@/lib/db/types";
import {
  computeCompoundScore,
  getActivityDisplayName,
  isHiddenGroupDefaultActivity,
  sortActivitiesByOrder,
} from "@/lib/activity";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import {
  buildActivityCompletionByDate,
  buildBreakDaysSet,
  buildEntriesByDateMap,
  computeCompletionTotals,
  completionRate,
  getToday,
  isCountableRoutine,
  isRoutineHabit,
} from "./completion";
import {
  buildAggregateHeatmap90,
  buildDailyCompletionTotals,
  buildMonthlyCompletionFromTotals,
  buildTimeOfDayBuckets,
  sumTimerMsByDate,
  sumTimerMsInRange,
} from "./aggregates";
import { buildSparklineWeeks } from "./compute-activity";
import type { ActivitySparklineDay, GroupStats, HabitComparisonRow } from "./types";

function buildHabitRow(
  activity: Activity,
  entriesByDate: Map<string, import("@/lib/db/types").DailyEntry>,
  breakDays: Set<string>,
  timerByDate: Record<string, number>,
  createdAt: Date,
  today: Date,
  thirtyDaysAgo: Date,
  ninetyDaysAgo: Date,
): HabitComparisonRow {
  const completionByDate = buildActivityCompletionByDate(
    activity,
    entriesByDate,
    breakDays,
    createdAt,
    today,
  );
  const totals30 = computeCompletionTotals(
    [activity],
    entriesByDate,
    breakDays,
    thirtyDaysAgo,
    today,
  );
  const totals90 = computeCompletionTotals(
    [activity],
    entriesByDate,
    breakDays,
    ninetyDaysAgo,
    today,
  );
  const createdAtStr = toDateString(
    startOfDay(new Date(getEffectiveToday(new Date(activity.created_at)) + "T00:00:00")),
  );

  const sparklineFrom = shiftDate(today, -27);
  const sparklineDays: ActivitySparklineDay[] = [];
  let cur = sparklineFrom;
  while (cur <= today) {
    const dateStr = toDateString(cur);
    if (dateStr < createdAtStr) {
      sparklineDays.push({ rate: 0, ms: 0 });
    } else {
      const dayTotals = computeCompletionTotals(
        [activity],
        entriesByDate,
        breakDays,
        cur,
        cur,
      );
      sparklineDays.push({
        rate: completionRate(dayTotals.completed, dayTotals.scheduled) ?? 0,
        ms: timerByDate[dateStr] ?? 0,
      });
    }
    cur = shiftDate(cur, 1);
  }

  return {
    activity,
    completionRate90d: completionRate(totals90.completed, totals90.scheduled),
    completed: totals90.completed,
    scheduled: totals90.scheduled,
    completionRate30d: completionRate(totals30.completed, totals30.scheduled),
    completed30d: totals30.completed,
    scheduled30d: totals30.scheduled,
    sparklineDays,
    sparklineWeeks: buildSparklineWeeks(completionByDate, createdAtStr, 12),
  };
}

export async function loadGroupStats(groupId: string): Promise<GroupStats | null> {
  const today = getToday();
  const thirtyDaysAgo = shiftDate(today, -29);
  const ninetyDaysAgo = shiftDate(today, -89);
  const yearAgo = shiftDate(today, -364);

  const [group, allActivities, allDailyEntries, allPeriods] = await Promise.all([
    db.activityGroups.get(groupId),
    db.activities
      .filter(
        (a) => a.group_id === groupId && !a.deleted_at && !isHiddenGroupDefaultActivity(a),
      )
      .toArray(),
    db.dailyEntries.filter((e) => !e.deleted_at).toArray(),
    db.activityPeriods.filter((p) => !p.deleted_at).toArray(),
  ]);

  if (!group) return null;

  const activities = sortActivitiesByOrder(allActivities);
  const active = activities.filter((a) => !a.completed_at);
  const completed = activities.filter((a) => !!a.completed_at);
  const countable = activities.filter(isCountableRoutine);
  const routineHabits = activities.filter(isRoutineHabit);

  const breakDays = buildBreakDaysSet(allDailyEntries);
  const entriesByDate = buildEntriesByDateMap(allDailyEntries);

  const totals30 = computeCompletionTotals(
    countable,
    entriesByDate,
    breakDays,
    thirtyDaysAgo,
    today,
  );
  const earliestCreated = activities.reduce((min, a) => {
    const d = startOfDay(new Date(getEffectiveToday(new Date(a.created_at)) + "T00:00:00"));
    return d < min ? d : min;
  }, today);
  const totalsAll = computeCompletionTotals(
    countable,
    entriesByDate,
    breakDays,
    earliestCreated,
    today,
  );

  const activityIds = new Set(activities.map((a) => a.id));
  const groupPeriods = allPeriods.filter((p) => activityIds.has(p.activity_id));
  const timerByActivity = new Map<string, Record<string, number>>();
  for (const activity of activities) {
    const periods = groupPeriods.filter((p) => p.activity_id === activity.id);
    timerByActivity.set(activity.id, sumTimerMsByDate(periods));
  }

  let totalTrackedMs = 0;
  for (const timerByDate of timerByActivity.values()) {
    totalTrackedMs += sumTimerMsInRange(timerByDate, earliestCreated, today);
  }

  const compoundScores: number[] = [];
  for (const activity of routineHabits.filter((a) => a.routine !== "never")) {
    const createdAt = startOfDay(
      new Date(getEffectiveToday(new Date(activity.created_at)) + "T00:00:00"),
    );
    compoundScores.push(
      computeCompoundScore(activity, entriesByDate, breakDays, createdAt, today),
    );
  }
  const groupCompoundScore =
    compoundScores.length > 0
      ? Math.round((compoundScores.reduce((s, v) => s + v, 0) / compoundScores.length) * 1000) /
        1000
      : null;

  const dailyTotalsYear = buildDailyCompletionTotals(
    countable,
    entriesByDate,
    breakDays,
    yearAgo,
    today,
  );

  const buildRows = (list: Activity[]) =>
    list.map((activity) =>
      buildHabitRow(
        activity,
        entriesByDate,
        breakDays,
        timerByActivity.get(activity.id) ?? {},
        startOfDay(new Date(getEffectiveToday(new Date(activity.created_at)) + "T00:00:00")),
        today,
        thirtyDaysAgo,
        ninetyDaysAgo,
      ),
    );

  const habitComparison = buildRows(active);

  const timerByHabit30d = activities
    .filter((a) => a.routine === "anytime")
    .map((activity) => ({
      activityId: activity.id,
      name: getActivityDisplayName(activity, group),
      ms: sumTimerMsInRange(timerByActivity.get(activity.id) ?? {}, thirtyDaysAgo, today),
    }))
    .filter((row) => row.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  return {
    group,
    completionRate30d: completionRate(totals30.completed, totals30.scheduled),
    completionRateAllTime: completionRate(totalsAll.completed, totalsAll.scheduled),
    totalTrackedMs,
    activeHabitCount: active.length,
    groupCompoundScore,
    consistencyHeatmap90: buildAggregateHeatmap90(countable, entriesByDate, breakDays),
    habitComparison,
    monthlyCompletion: buildMonthlyCompletionFromTotals(dailyTotalsYear),
    timerByHabit30d,
    timeOfDayBuckets: buildTimeOfDayBuckets(groupPeriods),
    completedHabits: buildRows(completed),
  };
}
