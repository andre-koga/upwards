import { db } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityStatusEvent,
  DailyEntry,
  GroupStatusEvent,
} from "@/lib/db/types";
import {
  shouldShowActivity,
  type TemporalVisibilityContext,
} from "@/lib/activity";
import { startOfDay, toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import {
  buildBreakDaysSet,
  buildEntriesByDateMap,
} from "@/lib/streak/entry-maps";
import {
  buildActivityStreakOutcomesByDate,
  deriveCurrentStreakFromOutcomes,
  type StreakEntryOverride,
  type StreakVisibilityChecker,
} from "@/lib/streak/projection";

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
function getActivityOriginDay(activity: Activity): Date {
  return startOfDay(
    new Date(getEffectiveToday(new Date(activity.created_at!)) + "T00:00:00")
  );
}

function createVisibilityChecker(
  activity: Activity,
  visibility?: StreakVisibilityDeps
): StreakVisibilityChecker {
  return (day: Date) => {
    if (!visibility) {
      return shouldShowActivity(activity, day, undefined, {
        viewDate: day,
        activityEventsById: new Map(),
        groupEventsById: new Map(),
      });
    }

    const group = visibility.groupById.get(activity.group_id);
    const temporal: TemporalVisibilityContext = {
      viewDate: day,
      activityEventsById: visibility.activityEventsById,
      groupEventsById: visibility.groupEventsById,
    };
    return shouldShowActivity(activity, day, group, temporal);
  };
}

interface SharedStreakData {
  entriesByDate: Map<string, DailyEntry>;
  breakDays: Set<string>;
}

async function loadSharedStreakData(
  fromDate: Date,
  toDate: Date
): Promise<SharedStreakData> {
  const startStr = toDateString(startOfDay(fromDate));
  const endStr = toDateString(startOfDay(toDate));

  const entries = await db.dailyEntries
    .where("date")
    .between(startStr, endStr, true, true)
    .filter((entry) => !entry.deleted_at)
    .toArray();

  return {
    entriesByDate: buildEntriesByDateMap(entries),
    breakDays: buildBreakDaysSet(entries),
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
  return buildActivityStreakOutcomesByDate(
    activity,
    shared.entriesByDate,
    shared.breakDays,
    fromDate,
    toDate,
    {
      isVisibleOnDay: createVisibilityChecker(activity, options?.visibility),
      entryOverride: options?.entryOverride,
    }
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

/**
 * Compute each activity's streak as of `date`.
 *
 * There is no cache to consult: the whole range is replayed from `dailyEntries`
 * on every call. The old `activityStreaks` Dexie cache was written here and read
 * nowhere, so it only bought an extra IndexedDB round-trip per activity.
 */
export async function computeActivityStreaksForDate(
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

  const earliestOrigin = eligible.reduce((earliest, activity) => {
    const origin = getActivityOriginDay(activity);
    return origin < earliest ? origin : earliest;
  }, getActivityOriginDay(eligible[0]!));

  const shared = await loadSharedStreakData(earliestOrigin, targetDay);

  for (const activity of eligible) {
    const { fromDate, toDate, originDate } = computeStreakRange(
      activity,
      targetDay
    );
    const outcomes = buildOutcomesForActivity(activity, shared, fromDate, toDate, {
      visibility,
      entryOverride:
        todayOverride?.date === targetDateStr ? todayOverride : undefined,
    });
    streaks[activity.id] = deriveCurrentStreakFromOutcomes(
      outcomes,
      targetDay,
      originDate
    );
  }

  return streaks;
}
