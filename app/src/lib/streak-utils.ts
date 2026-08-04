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
import {
  activityLikeFromDefinition,
  pickDefinitionVersionAsOf,
} from "@/lib/activity/definition-versions";
import { getScheduledDayOutcome } from "@/lib/activity/compound-score";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";

export interface StreakVisibilityDeps {
  groupById: Map<string, ActivityGroup>;
  activityEventsById: Map<string, ActivityStatusEvent[]>;
  groupEventsById: Map<string, GroupStatusEvent[]>;
}

function shouldShowActivityForStreak(
  activity: Activity,
  day: Date,
  visibility?: StreakVisibilityDeps,
  definitionVersions?: ActivityDefinitionVersion[]
): boolean {
  const resolvedVersion = definitionVersions?.length
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
}

function isStreakEligible(activity: Activity): boolean {
  return activity.routine !== "anytime";
}

type SchedulableActivity = Pick<
  Activity,
  "id" | "routine" | "created_at" | "completion_target"
>;

/** Logical first day an activity can contribute to streak history. */
export function getActivityOriginDay(activity: Activity): Date {
  return startOfDay(
    new Date(
      getEffectiveToday(new Date(activity.created_at!)) + "T00:00:00"
    )
  );
}

function buildBreakDaysFromEntries(entries: DailyEntry[]): Set<string> {
  const breakDays = new Set<string>();
  for (const entry of entries) {
    if (entry.is_break_day) breakDays.add(entry.date);
  }
  return breakDays;
}

export interface TodayOverride {
  date: string;
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
}

/**
 * Compute streak by walking backwards from targetDate.
 * Count consecutive "done" days, skip days that were paused/break/not-scheduled/hidden.
 * Stop on the first "missed" day.
 */
async function computeStreakBackward(
  activity: Activity,
  targetDate: Date,
  visibility?: StreakVisibilityDeps,
  todayOverride?: TodayOverride
): Promise<number> {
  if (!isStreakEligible(activity)) return 0;

  const definitionVersions = await db.activityDefinitionVersions
    .where("activity_id")
    .equals(activity.id)
    .filter((row) => !row.deleted_at)
    .toArray();

  const resolveSchedulable = (day: Date): SchedulableActivity => {
    const version = pickDefinitionVersionAsOf(
      definitionVersions,
      toDateString(day)
    );
    if (version) {
      return { ...activityLikeFromDefinition(version), id: activity.id };
    }
    return activity;
  };

  const targetDay = startOfDay(targetDate);
  const creationDay = getActivityOriginDay(activity);
  if (targetDay < creationDay) return 0;
  if (
    !shouldShowActivityForStreak(
      activity,
      targetDay,
      visibility,
      definitionVersions
    )
  ) {
    return 0;
  }

  const startStr = toDateString(creationDay);
  const endStr = toDateString(targetDay);
  const entries = await db.dailyEntries
    .where("date")
    .between(startStr, endStr, true, true)
    .filter((e) => !e.deleted_at)
    .toArray();
  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const breakDays = buildBreakDaysFromEntries(entries);

  let streak = 0;
  let cursor = targetDay;

  while (cursor >= creationDay) {
    if (
      !shouldShowActivityForStreak(
        activity,
        cursor,
        visibility,
        definitionVersions
      )
    ) {
      cursor = shiftDate(cursor, -1);
      continue;
    }

    const dateStr = toDateString(cursor);
    const schedulable = resolveSchedulable(cursor);

    // Use in-memory state for today instead of waiting for the DB write.
    let entryForDay: DailyEntry | undefined;
    if (todayOverride && dateStr === todayOverride.date) {
      entryForDay = {
        id: "",
        date: todayOverride.date,
        task_counts: todayOverride.taskCounts,
        paused_task_ids: todayOverride.pausedTaskIds,
        is_break_day: todayOverride.isBreakDay,
        current_activity_id: null,
        created_at: "",
        updated_at: "",
        synced_at: null,
        deleted_at: null,
      };
    } else {
      entryForDay = entriesByDate.get(dateStr);
    }

    const outcome = getScheduledDayOutcome(
      activity,
      cursor,
      entryForDay,
      breakDays,
      {
        definitionVersions,
        schedulable,
      }
    );

    if (outcome === "win") {
      streak++;
      cursor = shiftDate(cursor, -1);
    } else if (outcome === "skip") {
      cursor = shiftDate(cursor, -1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Walk forward from origin to target and return the longest consecutive win streak.
 * Uses the same temporal day outcomes as current streak computation.
 */
export async function computeBestActivityStreak(
  activity: Activity,
  fromDate: Date,
  toDate: Date,
  options?: { visibility?: StreakVisibilityDeps }
): Promise<number> {
  if (!isStreakEligible(activity)) return 0;

  const visibility = options?.visibility;
  const definitionVersions = await db.activityDefinitionVersions
    .where("activity_id")
    .equals(activity.id)
    .filter((row) => !row.deleted_at)
    .toArray();

  const resolveSchedulable = (day: Date): SchedulableActivity => {
    const version = pickDefinitionVersionAsOf(
      definitionVersions,
      toDateString(day)
    );
    if (version) {
      return { ...activityLikeFromDefinition(version), id: activity.id };
    }
    return activity;
  };

  const originDay = getActivityOriginDay(activity);
  const startDay = fromDate > originDay ? startOfDay(fromDate) : originDay;
  const endDay = startOfDay(toDate);
  if (endDay < startDay) return 0;

  const entries = await db.dailyEntries
    .where("date")
    .between(toDateString(startDay), toDateString(endDay), true, true)
    .filter((e) => !e.deleted_at)
    .toArray();
  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const breakDays = buildBreakDaysFromEntries(entries);

  let running = 0;
  let best = 0;
  let cursor = startDay;

  while (cursor <= endDay) {
    if (
      !shouldShowActivityForStreak(
        activity,
        cursor,
        visibility,
        definitionVersions
      )
    ) {
      cursor = shiftDate(cursor, 1);
      continue;
    }

    const schedulable = resolveSchedulable(cursor);
    const outcome = getScheduledDayOutcome(
      activity,
      cursor,
      entriesByDate.get(toDateString(cursor)),
      breakDays,
      {
        definitionVersions,
        schedulable,
      }
    );

    if (outcome === "win") {
      running++;
      best = Math.max(best, running);
    } else if (outcome === "loss") {
      running = 0;
    }

    cursor = shiftDate(cursor, 1);
  }

  return best;
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
  const targetDateStr = toDateString(startOfDay(date));
  const streaks: Record<string, number> = {};

  await Promise.all(
    activities.map(async (activity) => {
      const streak = await computeStreakBackward(
        activity,
        date,
        visibility,
        todayOverride
      );
      streaks[activity.id] = streak;

      // Cache the result
      const existing = await db.activityStreaks
        .where("[activity_id+date]")
        .equals([activity.id, targetDateStr])
        .filter((row) => !row.deleted_at)
        .first();

      if (existing) {
        if (existing.streak !== streak) {
          await db.activityStreaks.update(existing.id, {
            streak,
            updated_at: now(),
          });
        }
      } else {
        const timestamp = now();
        await db.activityStreaks.add({
          id: newId(),
          activity_id: activity.id,
          date: targetDateStr,
          streak,
          created_at: timestamp,
          updated_at: timestamp,
          synced_at: null,
          deleted_at: null,
        });
      }
    })
  );

  return streaks;
}

/**
 * Full recompute from a given date forward. Used by the manual "recalculate" button.
 * Walks forward and writes streak rows for each day.
 */
export async function recomputeActivityStreaksFromDateForActivities(
  activities: Activity[],
  fromDate: Date,
  options?: { visibility?: StreakVisibilityDeps }
): Promise<void> {
  const todayDay = startOfDay(new Date(getEffectiveToday() + "T00:00:00"));
  const fromDay = startOfDay(fromDate);
  const endDay = todayDay.getTime() > fromDay.getTime() ? todayDay : fromDay;
  const visibility = options?.visibility;

  const eligible = activities.filter(isStreakEligible);
  await Promise.all(
    eligible.map(async (activity) => {
      let cursor = fromDay;
      while (cursor <= endDay) {
        const streak = await computeStreakBackward(
          activity,
          cursor,
          visibility
        );
        const dateStr = toDateString(cursor);

        const existing = await db.activityStreaks
          .where("[activity_id+date]")
          .equals([activity.id, dateStr])
          .filter((row) => !row.deleted_at)
          .first();

        if (existing) {
          if (existing.streak !== streak) {
            await db.activityStreaks.update(existing.id, {
              streak,
              updated_at: now(),
            });
          }
        } else {
          const timestamp = now();
          await db.activityStreaks.add({
            id: newId(),
            activity_id: activity.id,
            date: dateStr,
            streak,
            created_at: timestamp,
            updated_at: timestamp,
            synced_at: null,
            deleted_at: null,
          });
        }

        cursor = shiftDate(cursor, 1);
      }
    })
  );
}
