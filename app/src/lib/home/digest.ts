import type { RankItem } from "../../../../supabase/functions/_shared/rank-today";

/**
 * What Home says with no AI at all: the few things in the last week's own
 * numbers that are worth acting on today. Every item carries the figures it
 * rests on, so the line a person reads can be checked, and none is shown
 * without something to do about it (design-and-branding.md §4.4).
 */

/** A streak this long, not yet done today, is worth protecting. */
const STREAK_AT_RISK_MIN_DAYS = 3;
/** A habit needs this many chances in the window before it can be "slipping". */
const SLIPPING_MIN_ACTIVE_DAYS = 4;
/** At or below this share of days done, a habit counts as slipping. */
const SLIPPING_MAX_SHARE = 0.4;
/** A journal streak this long, with today unwritten, is worth protecting. */
const JOURNAL_STREAK_AT_RISK_MIN_DAYS = 2;
const MAX_DIGEST_ITEMS = 4;

export interface DigestHabit {
  id: string;
  name: string;
  pinned: boolean;
  /** The same figures the AI ordering reads: the last seven full days, and today. */
  figures: Pick<
    RankItem,
    "type" | "target" | "doneToday" | "daysDone" | "daysActive" | "streak"
  >;
}

export interface DigestInput {
  habits: readonly DigestHabit[];
  journal: {
    /** Today already has an emoji, a title and text. */
    writtenToday: boolean;
    /** Consecutive complete days up to and including yesterday. */
    streakBeforeToday: number;
  };
}

export type DigestItem =
  | {
      kind: "streak-at-risk";
      activityId: string;
      name: string;
      pinned: boolean;
      streak: number;
      doneToday: number;
      target: number;
    }
  | {
      kind: "slipping";
      activityId: string;
      name: string;
      pinned: boolean;
      daysDone: number;
      daysActive: number;
    }
  | { kind: "journal-streak"; streak: number };

/**
 * The items, most urgent first: a streak that would break, then a journal
 * streak that would, then habits that have been slipping. A time-only activity
 * has no daily target to miss, so it never appears.
 */
export function buildDigest(
  input: DigestInput,
  max: number = MAX_DIGEST_ITEMS
): DigestItem[] {
  const habits = input.habits.filter((habit) => habit.figures.type === "habit");

  const atRisk = habits
    .filter(
      (habit) =>
        habit.figures.streak >= STREAK_AT_RISK_MIN_DAYS &&
        habit.figures.doneToday < habit.figures.target
    )
    .sort((a, b) => b.figures.streak - a.figures.streak);
  const atRiskIds = new Set(atRisk.map((habit) => habit.id));

  const slipping = habits
    .filter(
      (habit) =>
        !atRiskIds.has(habit.id) &&
        habit.figures.daysActive >= SLIPPING_MIN_ACTIVE_DAYS &&
        habit.figures.daysDone / habit.figures.daysActive <=
          SLIPPING_MAX_SHARE &&
        habit.figures.doneToday < habit.figures.target
    )
    .sort(
      (a, b) =>
        a.figures.daysDone / a.figures.daysActive -
          b.figures.daysDone / b.figures.daysActive ||
        b.figures.daysActive - a.figures.daysActive
    );

  const items: DigestItem[] = [
    ...atRisk.map(
      (habit): DigestItem => ({
        kind: "streak-at-risk",
        activityId: habit.id,
        name: habit.name,
        pinned: habit.pinned,
        streak: habit.figures.streak,
        doneToday: habit.figures.doneToday,
        target: habit.figures.target,
      })
    ),
  ];

  if (
    !input.journal.writtenToday &&
    input.journal.streakBeforeToday >= JOURNAL_STREAK_AT_RISK_MIN_DAYS
  ) {
    items.push({
      kind: "journal-streak",
      streak: input.journal.streakBeforeToday,
    });
  }

  items.push(
    ...slipping.map(
      (habit): DigestItem => ({
        kind: "slipping",
        activityId: habit.id,
        name: habit.name,
        pinned: habit.pinned,
        daysDone: habit.figures.daysDone,
        daysActive: habit.figures.daysActive,
      })
    )
  );

  return items.slice(0, max);
}
