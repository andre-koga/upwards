import type {
  Activity,
  ActivityDefinitionVersion,
  DailyEntry,
} from "@/lib/db/types";
import {
  getScheduledDayOutcome,
  type ScheduledDayOutcome,
} from "@/lib/activity/day-outcome";
import { shiftDate, startOfDay, toDateString } from "@/lib/time-utils";

/** Streak interpretation of a logical day (includes lifecycle visibility). */
export type StreakDayOutcome = ScheduledDayOutcome | "hidden";

export interface StreakEntryOverride {
  date: string;
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
}

export type StreakVisibilityChecker = (day: Date) => boolean;

function syntheticEntryFromOverride(override: StreakEntryOverride): DailyEntry {
  return {
    id: "",
    date: override.date,
    task_counts: override.taskCounts,
    paused_task_ids: override.pausedTaskIds,
    is_break_day: override.isBreakDay,
    current_activity_id: null,
    created_at: "",
    updated_at: "",
    synced_at: null,
    deleted_at: null,
  };
}

/**
 * Build per-day streak outcomes for an activity across a date range.
 * Uses the shared temporal day-outcome resolver (`getScheduledDayOutcome`).
 */
export function buildActivityStreakOutcomesByDate(
  activity: Activity,
  entriesByDate: Map<string, DailyEntry>,
  breakDays: Set<string>,
  fromDate: Date,
  toDate: Date,
  options: {
    definitionVersions?: ActivityDefinitionVersion[];
    isVisibleOnDay: StreakVisibilityChecker;
    entryOverride?: StreakEntryOverride;
  }
): Record<string, StreakDayOutcome> {
  const outcomes: Record<string, StreakDayOutcome> = {};
  const versions = options.definitionVersions ?? [];
  const fromStr = toDateString(startOfDay(fromDate));
  let cursor = startOfDay(fromDate);
  const end = startOfDay(toDate);

  while (cursor <= end) {
    const dateStr = toDateString(cursor);
    if (dateStr < fromStr) {
      cursor = shiftDate(cursor, 1);
      continue;
    }

    if (!options.isVisibleOnDay(cursor)) {
      outcomes[dateStr] = "hidden";
      cursor = shiftDate(cursor, 1);
      continue;
    }

    const entry =
      options.entryOverride?.date === dateStr
        ? syntheticEntryFromOverride(options.entryOverride)
        : entriesByDate.get(dateStr);

    outcomes[dateStr] = getScheduledDayOutcome(
      activity,
      cursor,
      entry,
      breakDays,
      { definitionVersions: versions }
    );

    cursor = shiftDate(cursor, 1);
  }

  return outcomes;
}

/** Current streak at the end of `targetDate` (walks backward through outcomes). */
export function deriveCurrentStreakFromOutcomes(
  outcomesByDate: Record<string, StreakDayOutcome>,
  targetDate: Date,
  originDate: Date
): number {
  const targetDay = startOfDay(targetDate);
  const originDay = startOfDay(originDate);
  if (targetDay < originDay) return 0;

  const targetStr = toDateString(targetDay);
  if (outcomesByDate[targetStr] === "hidden") return 0;

  let streak = 0;
  let cursor = targetDay;

  while (cursor >= originDay) {
    const outcome = outcomesByDate[toDateString(cursor)];
    if (!outcome || outcome === "hidden") {
      cursor = shiftDate(cursor, -1);
      continue;
    }
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
 * Streak at the end of each visible day in range (O(n) forward pass).
 * Hidden days store 0; skip days preserve the running streak.
 */
export function deriveStreakSeriesFromOutcomes(
  outcomesByDate: Record<string, StreakDayOutcome>,
  fromDate: Date,
  toDate: Date,
  originDate: Date
): Record<string, number> {
  const series: Record<string, number> = {};
  const startDay = startOfDay(fromDate);
  const endDay = startOfDay(toDate);
  const originDay = startOfDay(originDate);
  if (endDay < startDay) return series;

  let running = 0;
  let cursor = startDay;

  while (cursor <= endDay) {
    const dateStr = toDateString(cursor);
    if (cursor < originDay) {
      cursor = shiftDate(cursor, 1);
      continue;
    }

    const outcome = outcomesByDate[dateStr];
    if (!outcome || outcome === "hidden") {
      series[dateStr] = 0;
    } else if (outcome === "win") {
      running++;
      series[dateStr] = running;
    } else if (outcome === "loss") {
      running = 0;
      series[dateStr] = 0;
    } else {
      series[dateStr] = running;
    }

    cursor = shiftDate(cursor, 1);
  }

  return series;
}
