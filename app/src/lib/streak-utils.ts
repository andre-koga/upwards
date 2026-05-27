import { db, newId, now } from "@/lib/db";
import type {
  Activity,
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
import { shouldShowActivity, type TemporalVisibilityContext } from "@/lib/activity";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";

export interface StreakVisibilityDeps {
  groupById: Map<string, ActivityGroup>;
  activityEventsById: Map<string, ActivityStatusEvent[]>;
  groupEventsById: Map<string, GroupStatusEvent[]>;
}

function shouldShowActivityForStreak(
  activity: Activity,
  day: Date,
  visibility?: StreakVisibilityDeps
): boolean {
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
}

function isStreakEligible(activity: Activity): boolean {
  return activity.routine !== "anytime";
}

type DayStatus = "done" | "missed" | "skip";

function getDayStatus(activity: Activity, entry: DailyEntry | undefined): DayStatus {
  if (!entry) {
    return isNeverRoutine(activity) ? "done" : "missed";
  }

  const pausedTaskIds = Array.isArray(entry.paused_task_ids) ? entry.paused_task_ids : [];
  if (!isNeverRoutine(activity) && pausedTaskIds.includes(activity.id)) {
    return "skip";
  }

  if (entry.is_break_day && !isNeverRoutine(activity)) {
    const completed = isCompletedOnEntry(activity, entry);
    return completed ? "done" : "skip";
  }

  const completed = isCompletedOnEntry(activity, entry);
  if (isNeverRoutine(activity)) {
    return completed ? "missed" : "done";
  }
  return completed ? "done" : "missed";
}

function isCompletedOnEntry(activity: Activity, entry: DailyEntry): boolean {
  const target = neverTaskTarget(activity);
  const taskCounts = (entry.task_counts as Record<string, number>) || {};
  const count = taskCounts[activity.id] || 0;
  if (isNeverRoutine(activity)) {
    return isNeverTaskSlipRecorded(activity, count);
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

  const targetDay = startOfDay(targetDate);
  const creationDay = startOfDay(new Date(activity.created_at));
  if (targetDay < creationDay) return 0;
  if (!shouldShowActivityForStreak(activity, targetDay, visibility)) return 0;

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
    if (!shouldShowActivityForStreak(activity, cursor, visibility)) {
      cursor = shiftDate(cursor, -1);
      continue;
    }

    const dateStr = toDateString(cursor);

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

    const status = getDayStatus(activity, entryForDay);
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
      const streak = await computeStreakBackward(activity, date, visibility, todayOverride);
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
  const todayDay = startOfDay(new Date());
  const fromDay = startOfDay(fromDate);
  const endDay = todayDay.getTime() > fromDay.getTime() ? todayDay : fromDay;
  const visibility = options?.visibility;

  const eligible = activities.filter(isStreakEligible);
  await Promise.all(
    eligible.map(async (activity) => {
      let cursor = fromDay;
      while (cursor <= endDay) {
        const streak = await computeStreakBackward(activity, cursor, visibility);
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
