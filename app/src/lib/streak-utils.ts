import { db, newId, now } from "@/lib/db";
import type { Activity, ActivityStreak, DailyEntry } from "@/lib/db/types";
import { shouldShowActivity } from "@/lib/activity";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";

function isStreakEligible(activity: Activity): boolean {
  return activity.routine !== "anytime";
}

function shouldIncrementStreak(
  activity: Activity,
  isCompleted: boolean
): boolean {
  if (activity.routine === "never") {
    return !isCompleted;
  }

  return isCompleted;
}

function getCreationDay(activity: Activity): Date {
  return startOfDay(new Date(activity.created_at));
}

async function getDailyEntriesByDateRange(
  startDate: string,
  endDate: string
): Promise<Map<string, DailyEntry>> {
  const entries = await db.dailyEntries
    .where("date")
    .between(startDate, endDate, true, true)
    .filter((entry) => !entry.deleted_at)
    .toArray();

  return new Map(entries.map((entry) => [entry.date, entry]));
}

function isCompletedOnDate(
  activity: Activity,
  entry: DailyEntry | undefined
): boolean {
  if (!entry) return false;
  const pausedTaskIds = Array.isArray(entry.paused_task_ids)
    ? entry.paused_task_ids
    : [];
  if (activity.routine !== "never" && pausedTaskIds.includes(activity.id)) {
    return false;
  }
  const target = activity.completion_target ?? 1;
  const taskCounts = (entry.task_counts as Record<string, number>) || {};
  return (taskCounts[activity.id] || 0) >= target;
}

type DailyTaskStreakStatus = "incrementable" | "reset" | "skip";

function getDailyTaskStreakStatus(
  activity: Activity,
  entry: DailyEntry | undefined
): DailyTaskStreakStatus {
  if (!entry) return "reset";
  const pausedTaskIds = Array.isArray(entry.paused_task_ids)
    ? entry.paused_task_ids
    : [];
  if (activity.routine !== "never" && pausedTaskIds.includes(activity.id)) {
    return "skip";
  }
  const isCompleted = isCompletedOnDate(activity, entry);

  // Break day behavior:
  // - Regular tasks: incomplete is neutral, complete still counts.
  // - Never tasks: non-completion can still count when explicitly not paused.
  if (entry.is_break_day && activity.routine !== "never" && !isCompleted) {
    return "skip";
  }

  return shouldIncrementStreak(activity, isCompleted)
    ? "incrementable"
    : "reset";
}

async function upsertActivityStreak(
  activityId: string,
  date: string,
  streak: number,
  existing?: ActivityStreak
): Promise<void> {
  const timestamp = now();

  if (existing) {
    // Avoid no-op rewrites that would trigger unnecessary sync debounce loops.
    if (existing.streak === streak && !existing.deleted_at) {
      return;
    }

    await db.activityStreaks.update(existing.id, {
      streak,
      updated_at: timestamp,
      deleted_at: null,
    });
    return;
  }

  await db.activityStreaks.add({
    id: newId(),
    activity_id: activityId,
    date,
    streak,
    created_at: timestamp,
    updated_at: timestamp,
    synced_at: null,
    deleted_at: null,
  });
}

async function ensureStreakForActivityOnDate(
  activity: Activity,
  targetDate: Date,
  forceRecomputeTarget: boolean
): Promise<number> {
  if (!isStreakEligible(activity)) return 0;

  const targetDay = startOfDay(targetDate);
  const targetDateStr = toDateString(targetDay);
  const creationDay = getCreationDay(activity);

  if (targetDay < creationDay) return 0;
  if (!shouldShowActivity(activity, targetDay)) return 0;

  const existingTargetRow = await db.activityStreaks
    .where("[activity_id+date]")
    .equals([activity.id, targetDateStr])
    .filter((row) => !row.deleted_at)
    .first();

  if (existingTargetRow && !forceRecomputeTarget) {
    return existingTargetRow.streak;
  }

  const historicalRows = await db.activityStreaks
    .where("activity_id")
    .equals(activity.id)
    .filter((row) => !row.deleted_at && row.date <= targetDateStr)
    .sortBy("date");

  const latestBeforeTarget = [...historicalRows]
    .reverse()
    .find((row) => row.date < targetDateStr);

  let computeStartDay = creationDay;
  let previousStreak = 0;

  if (latestBeforeTarget) {
    const latestDay = startOfDay(
      new Date(`${latestBeforeTarget.date}T00:00:00`)
    );
    computeStartDay = shiftDate(latestDay, 1);
    previousStreak = latestBeforeTarget.streak;
  }

  if (computeStartDay > targetDay) {
    return existingTargetRow?.streak ?? previousStreak;
  }

  const startDateStr = toDateString(computeStartDay);
  const entriesByDate = await getDailyEntriesByDateRange(
    startDateStr,
    targetDateStr
  );
  const streakRowByDate = new Map(historicalRows.map((row) => [row.date, row]));

  let cursorDay = computeStartDay;
  let targetStreak = existingTargetRow?.streak ?? 0;

  while (cursorDay <= targetDay) {
    if (!shouldShowActivity(activity, cursorDay)) {
      cursorDay = shiftDate(cursorDay, 1);
      continue;
    }

    const dateStr = toDateString(cursorDay);
    const streakStatus = getDailyTaskStreakStatus(
      activity,
      entriesByDate.get(dateStr)
    );
    const nextStreak =
      streakStatus === "skip"
        ? previousStreak
        : streakStatus === "incrementable"
          ? previousStreak + 1
          : 0;
    const existingRow = streakRowByDate.get(dateStr);

    await upsertActivityStreak(activity.id, dateStr, nextStreak, existingRow);
    streakRowByDate.set(dateStr, {
      id: existingRow?.id ?? newId(),
      activity_id: activity.id,
      date: dateStr,
      streak: nextStreak,
      created_at: existingRow?.created_at ?? now(),
      updated_at: now(),
      synced_at: existingRow?.synced_at ?? null,
      deleted_at: null,
    });

    if (dateStr === targetDateStr) {
      targetStreak = nextStreak;
    }

    previousStreak = nextStreak;
    cursorDay = shiftDate(cursorDay, 1);
  }

  return targetStreak;
}

export async function getOrComputeActivityStreaksForDate(
  activities: Activity[],
  date: Date,
  options?: { forceRecomputeTarget?: boolean }
): Promise<Record<string, number>> {
  const streaks: Record<string, number> = {};
  const forceRecomputeTarget = options?.forceRecomputeTarget ?? false;

  await Promise.all(
    activities.map(async (activity) => {
      streaks[activity.id] = await ensureStreakForActivityOnDate(
        activity,
        date,
        forceRecomputeTarget
      );
    })
  );

  return streaks;
}
