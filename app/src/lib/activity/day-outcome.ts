import type {
  Activity,
  ActivityDefinitionVersion,
  DailyEntry,
} from "@/lib/db/types";
import { toDateString } from "@/lib/time-utils";
import {
  activityLikeFromDefinition,
  pickDefinitionVersionAsOf,
} from "./definition-versions";
import { isNeverRoutine, isNeverTaskSlipRecorded } from "./never-task";
import { isRoutineDueOnDate } from "./utils";

export type SchedulableActivity = Pick<
  Activity,
  "routine" | "created_at" | "completion_target"
>;

export type ScheduledDayOutcome = "skip" | "win" | "loss";

function taskCountForActivity(
  activity: Activity,
  entry: DailyEntry | undefined
): number {
  if (!entry) return 0;
  const counts = entry.task_counts as Record<string, number> | null;
  return counts?.[activity.id] ?? 0;
}

function isPausedOnEntry(
  activity: Activity,
  schedulable: SchedulableActivity,
  entry: DailyEntry | undefined
): boolean {
  if (!entry || isNeverRoutine(schedulable)) return false;
  const paused = entry.paused_task_ids;
  return Array.isArray(paused) && paused.includes(activity.id);
}

function isSuccessfulCompletion(
  schedulable: SchedulableActivity,
  count: number
): boolean {
  if (isNeverRoutine(schedulable)) {
    return !isNeverTaskSlipRecorded(schedulable, count);
  }
  return count >= (schedulable.completion_target ?? 1);
}

function resolveSchedulableForDate(
  activity: Activity,
  date: Date,
  options?: {
    schedulable?: SchedulableActivity;
    definitionVersions?: ActivityDefinitionVersion[];
  }
): SchedulableActivity {
  if (options?.schedulable) return options.schedulable;
  if (options?.definitionVersions?.length) {
    const version = pickDefinitionVersionAsOf(
      options.definitionVersions,
      toDateString(date)
    );
    if (version) return activityLikeFromDefinition(version);
  }
  return activity;
}

/** Classify a single scheduled day as win, loss, or skip. */
export function getScheduledDayOutcome(
  activity: Activity,
  date: Date,
  entry: DailyEntry | undefined,
  breakDays: Set<string>,
  options?: {
    countBreakDayMisses?: boolean;
    schedulable?: SchedulableActivity;
    definitionVersions?: ActivityDefinitionVersion[];
  }
): ScheduledDayOutcome {
  const dateStr = toDateString(date);
  const schedulable = resolveSchedulableForDate(activity, date, options);
  const isNever = isNeverRoutine(schedulable);

  if (breakDays.has(dateStr) && !isNever && !options?.countBreakDayMisses) {
    const count = taskCountForActivity(activity, entry);
    return isSuccessfulCompletion(schedulable, count) ? "win" : "skip";
  }

  if (!isRoutineDueOnDate(schedulable, date)) return "skip";
  if (isPausedOnEntry(activity, schedulable, entry)) return "skip";

  const count = taskCountForActivity(activity, entry);
  return isSuccessfulCompletion(schedulable, count) ? "win" : "loss";
}
