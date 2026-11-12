import { db } from "@/lib/db";
import type { ActivityPeriod, DailyEntry, JournalEntry } from "@/lib/db/types";
import { fromDateString, toDateString } from "@/lib/time-utils";

/**
 * What a person does, read from their own habits and journal on this device.
 * It never leaves the device and no model is involved.
 *
 * Only two traits have a signal worth showing:
 * - conscientiousness: how many days they logged something;
 * - openness: how many different activities and places they have lately.
 *
 * Extraversion, agreeableness and neuroticism cannot be seen in habit data, so
 * they are left out rather than guessed.
 */
export const BEHAVIOUR_RANGES = [30, 90, 180] as const;
export type BehaviourRange = (typeof BEHAVIOUR_RANGES)[number];
export const DEFAULT_BEHAVIOUR_RANGE: BehaviourRange = 30;
/**
 * Different activities plus places that read as the top of the scale. A longer
 * range meets more of both, so its bar is higher, but not in step with the days.
 */
export const VARIETY_TOP: Record<BehaviourRange, number> = {
  30: 12,
  90: 20,
  180: 28,
};
/** Days of history needed before the signal means anything. */
export const MIN_HISTORY_DAYS = 14;
/** Days with something logged needed before the signal means anything. */
export const MIN_ACTIVE_DAYS = 5;

export interface BehaviourInput {
  periods: Pick<ActivityPeriod, "activity_id" | "start_time" | "deleted_at">[];
  daily: Pick<
    DailyEntry,
    "date" | "task_counts" | "completion_times" | "is_break_day" | "deleted_at"
  >[];
  journal: Pick<
    JournalEntry,
    "entry_date" | "title" | "text_content" | "location" | "deleted_at"
  >[];
}

export interface Behaviour {
  /** 0-100: the share of days in the window with something logged. */
  conscientiousness: number;
  /** 0-100: how much variety the window held. */
  openness: number;
  detail: {
    /** Days counted: the range, or fewer when the history is shorter. */
    windowDays: number;
    activeDays: number;
    /** Days in the window that were not break days. */
    countedDays: number;
    activities: number;
    places: number;
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysBetween(from: string, to: string): number {
  const ms = fromDateString(to).getTime() - fromDateString(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** The signal, or null when there is not yet enough history to read. */
export function behaviourSignal(
  input: BehaviourInput,
  today: string,
  range: BehaviourRange = DEFAULT_BEHAVIOUR_RANGE
): Behaviour | null {
  // Days before the person started using the app do not count against them.
  const dates = [
    ...input.periods
      .filter((row) => !row.deleted_at)
      .map((row) => toDateString(new Date(row.start_time))),
    ...input.daily.filter((row) => !row.deleted_at).map((row) => row.date),
    ...input.journal
      .filter((row) => !row.deleted_at)
      .map((row) => row.entry_date),
  ];
  if (dates.length === 0) return null;
  const earliest = dates.reduce((min, date) => (date < min ? date : min));
  const history = daysBetween(earliest, today) + 1;
  if (history < MIN_HISTORY_DAYS) return null;
  const windowDays = Math.min(range, history);

  const start = fromDateString(today);
  start.setDate(start.getDate() - (windowDays - 1));
  const oldest = toDateString(start);
  const inWindow = (date: string) => date >= oldest && date <= today;

  const active = new Set<string>();
  const breakDays = new Set<string>();
  const activities = new Set<string>();
  const places = new Set<string>();

  for (const period of input.periods) {
    if (period.deleted_at) continue;
    const date = toDateString(new Date(period.start_time));
    if (!inWindow(date)) continue;
    active.add(date);
    activities.add(period.activity_id);
  }

  for (const row of input.daily) {
    if (row.deleted_at || !inWindow(row.date)) continue;
    if (row.is_break_day) breakDays.add(row.date);
    const done = Object.entries(row.task_counts ?? {}).filter(
      ([, count]) => count > 0
    );
    const timed = Object.keys(row.completion_times ?? {});
    if (done.length > 0 || timed.length > 0) active.add(row.date);
    for (const [id] of done) activities.add(id);
    for (const id of timed) activities.add(id);
  }

  for (const entry of input.journal) {
    if (entry.deleted_at || !inWindow(entry.entry_date)) continue;
    if ((entry.title ?? "").trim() || (entry.text_content ?? "").trim()) {
      active.add(entry.entry_date);
    }
    for (const place of entry.location?.locations ?? []) {
      const name = (place.city ?? place.displayName ?? "").trim();
      if (name) places.add(name.toLowerCase());
    }
  }

  if (active.size < MIN_ACTIVE_DAYS) return null;

  const countedDays = Math.max(1, windowDays - breakDays.size);
  // A day logged on a break day still counts as a day, never over 100.
  const activeDays = [...active].filter((day) => !breakDays.has(day)).length;
  return {
    conscientiousness: clamp((activeDays / countedDays) * 100),
    openness: clamp(
      ((activities.size + places.size) / VARIETY_TOP[range]) * 100
    ),
    detail: {
      windowDays,
      activeDays,
      countedDays,
      activities: activities.size,
      places: places.size,
    },
  };
}

/** Reads the rows the signal needs from this device. */
export async function loadBehaviour(
  range: BehaviourRange = DEFAULT_BEHAVIOUR_RANGE,
  today = toDateString(new Date())
): Promise<Behaviour | null> {
  const [periods, daily, journal] = await Promise.all([
    db.activityPeriods.toArray(),
    db.dailyEntries.toArray(),
    db.journalEntries.toArray(),
  ]);
  return behaviourSignal({ periods, daily, journal }, today, range);
}
