import type {
  Activity,
  ActivityDefinitionVersion,
  DailyEntry,
} from "@/lib/db/types";
import { shiftDate, toDateString } from "@/lib/time-utils";
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

const INITIAL_SCORE = 1;
const WIN_MULTIPLIER = 1.01;
const LOSS_MULTIPLIER = 0.99;

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

/** Classify a single day for compound score (scheduled wins/losses only). */
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

export function computeCompoundScore(
  activity: Activity,
  entriesByDate: Map<string, DailyEntry>,
  breakDays: Set<string>,
  fromDate: Date,
  toDate: Date,
  definitionVersions?: ActivityDefinitionVersion[]
): number {
  let score = INITIAL_SCORE;
  let cursor = fromDate;
  while (cursor <= toDate) {
    const entry = entriesByDate.get(toDateString(cursor));
    const outcome = getScheduledDayOutcome(activity, cursor, entry, breakDays, {
      definitionVersions,
    });
    if (outcome === "win") score *= WIN_MULTIPLIER;
    else if (outcome === "loss") score *= LOSS_MULTIPLIER;
    cursor = shiftDate(cursor, 1);
  }
  return Math.round(score * 1000) / 1000;
}

export function formatCompoundScore(score: number): string {
  return score.toFixed(3);
}

export type CompoundScorePoint = {
  dateStr: string;
  score: number;
};

/** End-of-day compound score for each day in [fromDate, toDate]. */
export function computeCompoundScoreSeries(
  activity: Activity,
  entriesByDate: Map<string, DailyEntry>,
  breakDays: Set<string>,
  createdAt: Date,
  fromDate: Date,
  toDate: Date,
  definitionVersions?: ActivityDefinitionVersion[]
): CompoundScorePoint[] {
  const scoreByDate = new Map<string, number>();
  let score = INITIAL_SCORE;
  let cursor = createdAt;
  while (cursor <= toDate) {
    const entry = entriesByDate.get(toDateString(cursor));
    const outcome = getScheduledDayOutcome(activity, cursor, entry, breakDays, {
      definitionVersions,
    });
    if (outcome === "win") score *= WIN_MULTIPLIER;
    else if (outcome === "loss") score *= LOSS_MULTIPLIER;
    scoreByDate.set(toDateString(cursor), Math.round(score * 1000) / 1000);
    cursor = shiftDate(cursor, 1);
  }

  const points: CompoundScorePoint[] = [];
  cursor = fromDate;
  while (cursor <= toDate) {
    const dateStr = toDateString(cursor);
    points.push({
      dateStr,
      score:
        cursor < createdAt
          ? INITIAL_SCORE
          : (scoreByDate.get(dateStr) ?? INITIAL_SCORE),
    });
    cursor = shiftDate(cursor, 1);
  }
  return points;
}
