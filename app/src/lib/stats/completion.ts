import type {
  Activity,
  ActivityDefinitionVersion,
  DailyEntry,
} from "@/lib/db/types";
import {
  isNeverRoutine,
  isNeverTaskSlipRecorded,
} from "@/lib/activity/never-task";
import { isRoutineDueOnDate } from "@/lib/activity/utils";
import {
  activityLikeFromDefinition,
  pickDefinitionVersionAsOf,
} from "@/lib/activity/definition-versions";
import { getScheduledDayOutcome } from "@/lib/activity/compound-score";
import { shiftDate, toDateString, startOfDay } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import type { DayStatus } from "./types";

/** Routine habits that count toward completion % (excludes anytime and never). */
export function isCountableRoutine(
  activity: Activity,
  options?: { includeCompleted?: boolean }
): boolean {
  return (
    activity.routine !== "anytime" &&
    activity.routine !== "never" &&
    (options?.includeCompleted === true || !activity.completed_at)
  );
}

export function isRoutineHabit(activity: Activity): boolean {
  return activity.routine !== "anytime";
}

export function buildBreakDaysSet(entries: DailyEntry[]): Set<string> {
  const breakDays = new Set<string>();
  for (const e of entries) {
    if (e.is_break_day) breakDays.add(e.date);
  }
  return breakDays;
}

export function buildEntriesByDateMap(
  entries: DailyEntry[]
): Map<string, DailyEntry> {
  const map = new Map<string, DailyEntry>();
  for (const e of entries) map.set(e.date, e);
  return map;
}

export function buildActivityCompletionByDate(
  activity: Activity,
  entriesByDate: Map<string, DailyEntry>,
  breakDays: Set<string>,
  fromDate: Date,
  toDate: Date,
  options?: { definitionVersions?: ActivityDefinitionVersion[] }
): Record<string, DayStatus> {
  const versions = options?.definitionVersions ?? [];
  const completionByDate: Record<string, DayStatus> = {};
  const createdAtStr = toDateString(fromDate);

  let cursor = fromDate;
  while (cursor <= toDate) {
    const dateStr = toDateString(cursor);
    if (dateStr < createdAtStr) {
      cursor = shiftDate(cursor, 1);
      continue;
    }

    const version = pickDefinitionVersionAsOf(versions, dateStr);
    const schedulable = version
      ? activityLikeFromDefinition(version)
      : activity;
    const isNever = isNeverRoutine(schedulable);
    const target = schedulable.completion_target ?? 1;

    const entry = entriesByDate.get(dateStr);
    if (breakDays.has(dateStr) && !isNever) {
      const counts = entry?.task_counts as Record<string, number> | null;
      const count = counts?.[activity.id] ?? 0;
      completionByDate[dateStr] = count >= target ? "done" : "break";
    } else if (isRoutineDueOnDate(schedulable, cursor)) {
      const counts = entry?.task_counts as Record<string, number> | null;
      const count = counts?.[activity.id] ?? 0;
      if (isNever) {
        completionByDate[dateStr] = isNeverTaskSlipRecorded(schedulable, count)
          ? "slip"
          : "done";
      } else {
        completionByDate[dateStr] = count >= target ? "done" : "missed";
      }
    } else {
      completionByDate[dateStr] = "not_scheduled";
    }
    cursor = shiftDate(cursor, 1);
  }

  return completionByDate;
}

const COUNTABLE_DAY_STATUSES: DayStatus[] = ["done", "missed", "slip"];

/** Per-activity completion totals from a pre-built completion map (includes never habits). */
export function computeActivityCompletionTotals(
  completionByDate: Record<string, DayStatus>,
  fromDate: Date,
  toDate: Date
): { completed: number; scheduled: number } {
  let completed = 0;
  let scheduled = 0;
  let cursor = fromDate;
  while (cursor <= toDate) {
    const status = completionByDate[toDateString(cursor)];
    if (status && COUNTABLE_DAY_STATUSES.includes(status)) {
      scheduled++;
      if (status === "done") completed++;
    }
    cursor = shiftDate(cursor, 1);
  }
  return { completed, scheduled };
}

export function dayCompletionRate(status: DayStatus | undefined): number {
  if (status === "done") return 100;
  if (status === "missed" || status === "slip") return 0;
  return 0;
}

/** Group completion totals across routine habits, including never tasks. */
export function computeGroupRoutineCompletionTotals(
  activities: Activity[],
  entriesByDate: Map<string, DailyEntry>,
  breakDays: Set<string>,
  fromDate: Date,
  toDate: Date,
  options?: { includeCompleted?: boolean }
): { completed: number; scheduled: number } {
  let completed = 0;
  let scheduled = 0;

  for (const activity of activities) {
    if (activity.routine === "anytime") continue;
    if (options?.includeCompleted !== true && activity.completed_at) continue;

    const createdAt = startOfDay(
      new Date(getEffectiveToday(new Date(activity.created_at)) + "T00:00:00")
    );
    const rangeFrom = fromDate > createdAt ? fromDate : createdAt;
    if (rangeFrom > toDate) continue;

    const completionByDate = buildActivityCompletionByDate(
      activity,
      entriesByDate,
      breakDays,
      createdAt,
      toDate
    );
    const totals = computeActivityCompletionTotals(
      completionByDate,
      rangeFrom,
      toDate
    );
    completed += totals.completed;
    scheduled += totals.scheduled;
  }

  return { completed, scheduled };
}

export function computeCompletionTotals(
  activities: Activity[],
  entriesByDate: Map<string, DailyEntry>,
  breakDays: Set<string>,
  fromDate: Date,
  toDate: Date,
  options?: { includeCompleted?: boolean; countBreakDayMisses?: boolean }
): { completed: number; scheduled: number } {
  let completed = 0;
  let scheduled = 0;

  const countable = activities.filter((a) => isCountableRoutine(a, options));
  if (countable.length === 0) return { completed: 0, scheduled: 0 };

  let cursor = fromDate;
  while (cursor <= toDate) {
    const entry = entriesByDate.get(toDateString(cursor));
    for (const activity of countable) {
      const outcome = getScheduledDayOutcome(
        activity,
        cursor,
        entry,
        breakDays,
        {
          countBreakDayMisses: options?.countBreakDayMisses,
        }
      );
      if (outcome === "win") {
        scheduled++;
        completed++;
      } else if (outcome === "loss") {
        scheduled++;
      }
    }
    cursor = shiftDate(cursor, 1);
  }

  return { completed, scheduled };
}

export function completionRate(
  completed: number,
  scheduled: number
): number | null {
  if (scheduled === 0) return null;
  return Math.round((completed / scheduled) * 100);
}

export function getToday(): Date {
  return startOfDay(new Date(getEffectiveToday() + "T00:00:00"));
}

export function dateRangeDaysBack(days: number): { from: Date; to: Date } {
  const to = getToday();
  const from = shiftDate(to, -(days - 1));
  return { from, to };
}
