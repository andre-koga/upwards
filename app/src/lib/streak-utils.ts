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
  isNeverRoutine,
  isNeverTaskSlipRecorded,
  neverTaskTarget,
} from "@/lib/activity/never-task";
import {
  shouldShowActivity,
  type TemporalVisibilityContext,
} from "@/lib/activity";
import {
  activityLikeFromDefinition,
  pickDefinitionVersionAsOf,
} from "@/lib/activity/definition-versions";
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

type DayStatus = "done" | "missed" | "skip";

type SchedulableActivity = Pick<
  Activity,
  "id" | "routine" | "created_at" | "completion_target"
>;

function getDayStatus(
  activity: Activity,
  schedulable: SchedulableActivity,
  entry: DailyEntry | undefined
): DayStatus {
  if (!entry) {
    return isNeverRoutine(schedulable) ? "done" : "missed";
  }

  const pausedTaskIds = Array.isArray(entry.paused_task_ids)
    ? entry.paused_task_ids
    : [];
  if (!isNeverRoutine(schedulable) && pausedTaskIds.includes(activity.id)) {
    return "skip";
  }

  if (entry.is_break_day && !isNeverRoutine(schedulable)) {
    const completed = isCompletedOnEntry(activity, schedulable, entry);
    return completed ? "done" : "skip";
  }

  const completed = isCompletedOnEntry(activity, schedulable, entry);
  if (isNeverRoutine(schedulable)) {
    return completed ? "missed" : "done";
  }
  return completed ? "done" : "missed";
}

function isCompletedOnEntry(
  activity: Activity,
  schedulable: SchedulableActivity,
  entry: DailyEntry
): boolean {
  const target = neverTaskTarget(schedulable);
  const taskCounts = (entry.task_counts as Record<string, number>) || {};
  const count = taskCounts[activity.id] || 0;
  if (isNeverRoutine(schedulable)) {
    return isNeverTaskSlipRecorded(schedulable, count);
  }
  return count >= target;
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
  const targetSchedulable = resolveSchedulable(targetDay);
  const creationDay = startOfDay(
    new Date(
      getEffectiveToday(new Date(targetSchedulable.created_at!)) + "T00:00:00"
    )
  );
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

    const status = getDayStatus(activity, schedulable, entryForDay);
    if (status === "done") {
      streak++;
      cursor = shiftDate(cursor, -1);
    } else if (status === "skip") {
      cursor = shiftDate(cursor, -1);
    } else {
      break;
    }
  }

  return streak;
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
