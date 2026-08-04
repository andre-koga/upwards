import { db, newId, now } from "@/lib/db";
import type {
  Activity,
  ActivityDefinitionVersion,
  ActivityGroup,
  ActivityStatusEvent,
  DailyEntry,
  GroupStatusEvent,
} from "@/lib/db/types";
import {
  shouldShowActivity,
  type TemporalVisibilityContext,
} from "@/lib/activity";
import { pickDefinitionVersionAsOf } from "@/lib/activity/definition-versions";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import {
  buildBreakDaysSet,
  buildEntriesByDateMap,
} from "@/lib/stats/completion";
import {
  buildActivityStreakOutcomesByDate,
  deriveBestStreakFromOutcomes,
  deriveCurrentStreakFromOutcomes,
  deriveStreakSeriesFromOutcomes,
  type StreakEntryOverride,
  type StreakVisibilityChecker,
} from "@/lib/stats/streak-projection";

export interface StreakVisibilityDeps {
  groupById: Map<string, ActivityGroup>;
  activityEventsById: Map<string, ActivityStatusEvent[]>;
  groupEventsById: Map<string, GroupStatusEvent[]>;
}

export type TodayOverride = StreakEntryOverride;

function isStreakEligible(activity: Activity): boolean {
  return activity.routine !== "anytime";
}

/** Logical first day an activity can contribute to streak history. */
export function getActivityOriginDay(activity: Activity): Date {
  return startOfDay(
    new Date(
      getEffectiveToday(new Date(activity.created_at!)) + "T00:00:00"
    )
  );
}

function createVisibilityChecker(
  activity: Activity,
  definitionVersions: ActivityDefinitionVersion[],
  visibility?: StreakVisibilityDeps
): StreakVisibilityChecker {
  return (day: Date) => {
    const resolvedVersion = definitionVersions.length
      ? pickDefinitionVersionAsOf(definitionVersions, toDateString(day))
      : null;
    const activityDefinitionsById = resolvedVersion
      ? new Map([[activity.id, resolvedVersion]])
      : undefined;

    if (!visibility) {
      return shouldShowActivity(activity, day, undefined, {
        viewDate: day,
        activityEventsById: new Map(),
        groupEventsById: new Map(),
        activityDefinitionsById,
      });
    }

    const group = visibility.groupById.get(activity.group_id);
    const temporal: TemporalVisibilityContext = {
      viewDate: day,
      activityEventsById: visibility.activityEventsById,
      groupEventsById: visibility.groupEventsById,
      activityDefinitionsById,
    };
    return shouldShowActivity(activity, day, group, temporal);
  };
}

interface SharedStreakData {
  entriesByDate: Map<string, DailyEntry>;
  breakDays: Set<string>;
  definitionVersionsByActivityId: Map<string, ActivityDefinitionVersion[]>;
}

async function loadSharedStreakData(
  activities: Activity[],
  fromDate: Date,
  toDate: Date
): Promise<SharedStreakData> {
  const startStr = toDateString(startOfDay(fromDate));
  const endStr = toDateString(startOfDay(toDate));
  const activityIds = activities.map((activity) => activity.id);

  const [entries, definitionVersions] = await Promise.all([
    db.dailyEntries
      .where("date")
      .between(startStr, endStr, true, true)
      .filter((entry) => !entry.deleted_at)
      .toArray(),
    activityIds.length === 0
      ? Promise.resolve([])
      : db.activityDefinitionVersions
          .where("activity_id")
          .anyOf(activityIds)
          .filter((row) => !row.deleted_at)
          .toArray(),
  ]);

  const definitionVersionsByActivityId = new Map<
    string,
    ActivityDefinitionVersion[]
  >();
  for (const version of definitionVersions) {
    const list = definitionVersionsByActivityId.get(version.activity_id) ?? [];
    list.push(version);
    definitionVersionsByActivityId.set(version.activity_id, list);
  }

  return {
    entriesByDate: buildEntriesByDateMap(entries),
    breakDays: buildBreakDaysSet(entries),
    definitionVersionsByActivityId,
  };
}

function buildOutcomesForActivity(
  activity: Activity,
  shared: SharedStreakData,
  fromDate: Date,
  toDate: Date,
  options?: {
    visibility?: StreakVisibilityDeps;
    entryOverride?: StreakEntryOverride;
  }
): ReturnType<typeof buildActivityStreakOutcomesByDate> {
  const definitionVersions =
    shared.definitionVersionsByActivityId.get(activity.id) ?? [];

  return buildActivityStreakOutcomesByDate(
    activity,
    shared.entriesByDate,
    shared.breakDays,
    fromDate,
    toDate,
    {
      definitionVersions,
      isVisibleOnDay: createVisibilityChecker(
        activity,
        definitionVersions,
        options?.visibility
      ),
      entryOverride: options?.entryOverride,
    }
  );
}

async function persistStreakCacheRows(
  activityId: string,
  series: Record<string, number>
): Promise<void> {
  const dates = Object.keys(series);
  if (dates.length === 0) return;

  await Promise.all(
    dates.map(async (dateStr) => {
      const streak = series[dateStr] ?? 0;
      const existing = await db.activityStreaks
        .where("[activity_id+date]")
        .equals([activityId, dateStr])
        .filter((row) => !row.deleted_at)
        .first();

      if (existing) {
        if (existing.streak !== streak) {
          await db.activityStreaks.update(existing.id, {
            streak,
            updated_at: now(),
          });
        }
        return;
      }

      const timestamp = now();
      await db.activityStreaks.add({
        id: newId(),
        activity_id: activityId,
        date: dateStr,
        streak,
        created_at: timestamp,
        updated_at: timestamp,
        synced_at: null,
        deleted_at: null,
      });
    })
  );
}

function computeStreakRange(
  activity: Activity,
  targetDate: Date
): { fromDate: Date; toDate: Date; originDate: Date } {
  const originDate = getActivityOriginDay(activity);
  const toDate = startOfDay(targetDate);
  return { fromDate: originDate, toDate, originDate };
}

export async function getOrComputeActivityStreaksForDate(
  activities: Activity[],
  date: Date,
  options?: {
    visibility?: StreakVisibilityDeps;
    todayOverride?: TodayOverride;
  }
): Promise<Record<string, number>> {
  const visibility = options?.visibility;
  const todayOverride = options?.todayOverride;
  const targetDay = startOfDay(date);
  const targetDateStr = toDateString(targetDay);
  const streaks: Record<string, number> = {};

  for (const activity of activities) {
    if (!isStreakEligible(activity)) {
      streaks[activity.id] = 0;
    }
  }

  const eligible = activities.filter(isStreakEligible);
  if (eligible.length === 0) return streaks;

  const earliestOrigin = eligible.reduce(
    (earliest, activity) => {
      const origin = getActivityOriginDay(activity);
      return origin < earliest ? origin : earliest;
    },
    getActivityOriginDay(eligible[0]!)
  );

  const shared = await loadSharedStreakData(eligible, earliestOrigin, targetDay);

  await Promise.all(
    eligible.map(async (activity) => {
      const { fromDate, toDate, originDate } = computeStreakRange(
        activity,
        targetDay
      );
      const outcomes = buildOutcomesForActivity(
        activity,
        shared,
        fromDate,
        toDate,
        {
          visibility,
          entryOverride:
            todayOverride?.date === targetDateStr ? todayOverride : undefined,
        }
      );
      const streak = deriveCurrentStreakFromOutcomes(
        outcomes,
        targetDay,
        originDate
      );
      streaks[activity.id] = streak;
      await persistStreakCacheRows(activity.id, {
        [targetDateStr]: streak,
      });
    })
  );

  return streaks;
}

export async function computeActivityStreakStats(
  activity: Activity,
  targetDate: Date,
  options?: {
    visibility?: StreakVisibilityDeps;
    todayOverride?: TodayOverride;
  }
): Promise<{ currentStreak: number; bestStreak: number }> {
  if (!isStreakEligible(activity)) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const targetDay = startOfDay(targetDate);
  const originDate = getActivityOriginDay(activity);
  const shared = await loadSharedStreakData([activity], originDate, targetDay);
  const outcomes = buildOutcomesForActivity(
    activity,
    shared,
    originDate,
    targetDay,
    options
  );

  const currentStreak = deriveCurrentStreakFromOutcomes(
    outcomes,
    targetDay,
    originDate
  );
  const bestStreak = deriveBestStreakFromOutcomes(
    outcomes,
    originDate,
    targetDay,
    originDate
  );

  await persistStreakCacheRows(activity.id, {
    [toDateString(targetDay)]: currentStreak,
  });

  return { currentStreak, bestStreak };
}

export async function computeBestActivityStreak(
  activity: Activity,
  fromDate: Date,
  toDate: Date,
  options?: { visibility?: StreakVisibilityDeps }
): Promise<number> {
  if (!isStreakEligible(activity)) return 0;

  const originDate = getActivityOriginDay(activity);
  const startDay = fromDate > originDate ? startOfDay(fromDate) : originDate;
  const endDay = startOfDay(toDate);
  if (endDay < startDay) return 0;

  const shared = await loadSharedStreakData([activity], startDay, endDay);
  const outcomes = buildOutcomesForActivity(
    activity,
    shared,
    startDay,
    endDay,
    options
  );

  return deriveBestStreakFromOutcomes(
    outcomes,
    startDay,
    endDay,
    originDate
  );
}

/**
 * Rebuild the disposable streak projection cache from a logical date forward.
 * Uses a single O(n) forward pass per activity instead of recomputing each day.
 */
export async function refreshActivityStreakProjectionFromDate(
  activities: Activity[],
  fromDate: Date,
  options?: { visibility?: StreakVisibilityDeps }
): Promise<void> {
  const todayDay = startOfDay(new Date(getEffectiveToday() + "T00:00:00"));
  const fromDay = startOfDay(fromDate);
  const endDay = todayDay.getTime() > fromDay.getTime() ? todayDay : fromDay;
  const eligible = activities.filter(isStreakEligible);
  if (eligible.length === 0) return;

  const earliestOrigin = eligible.reduce(
    (earliest, activity) => {
      const origin = getActivityOriginDay(activity);
      return origin < earliest ? origin : earliest;
    },
    getActivityOriginDay(eligible[0]!)
  );
  const rangeStart = fromDay < earliestOrigin ? earliestOrigin : fromDay;

  const shared = await loadSharedStreakData(eligible, rangeStart, endDay);

  await Promise.all(
    eligible.map(async (activity) => {
      const originDate = getActivityOriginDay(activity);
      const outcomes = buildOutcomesForActivity(
        activity,
        shared,
        rangeStart,
        endDay,
        options
      );
      const series = deriveStreakSeriesFromOutcomes(
        outcomes,
        rangeStart,
        endDay,
        originDate
      );
      await persistStreakCacheRows(activity.id, series);
    })
  );
}

/**
 * Incrementally refresh streak cache for one activity after a daily-entry mutation.
 */
export async function refreshActivityStreakProjectionForActivity(
  activityId: string,
  fromDate: Date,
  options?: { visibility?: StreakVisibilityDeps }
): Promise<void> {
  const activity = await db.activities.get(activityId);
  if (!activity || activity.deleted_at || !isStreakEligible(activity)) return;
  await refreshActivityStreakProjectionFromDate([activity], fromDate, options);
}

/** Full recompute from a given date forward. Used by the manual "recalculate" button. */
export async function recomputeActivityStreaksFromDateForActivities(
  activities: Activity[],
  fromDate: Date,
  options?: { visibility?: StreakVisibilityDeps }
): Promise<void> {
  await refreshActivityStreakProjectionFromDate(activities, fromDate, options);
}
