import { db } from "@/lib/db";
import {
  fromDateString,
  shiftDate,
  toDateString,
  todayDateString,
} from "@/lib/time-utils";
import { journalStreakAsOf } from "@/lib/journal/streak";
import { loadHabitFacts } from "@/lib/ai/habit-facts";

const RANGE_DAYS = 7;

export interface ActivityInsightStat {
  name: string;
  targetPerDay: number;
  completedDays: number;
  totalDays: number;
  streak: number;
}

export interface InsightPayload {
  range: string;
  activities: ActivityInsightStat[];
  journal: {
    entriesThisWeek: number;
    streak: number;
    bookmarkedCount: number;
  };
  completionRate: number;
}

/**
 * Builds the *aggregated* stats sent to the AI provider — never raw journal
 * or task text. This is the main token-budget control point: keep this
 * payload small and numeric.
 */
export async function buildInsightPayload(): Promise<InsightPayload> {
  const today = todayDateString();
  // The journal window is the seven days ending today.
  const startStr = toDateString(
    shiftDate(fromDateString(today), -(RANGE_DAYS - 1))
  );

  // The habits come from the same facts Home's digest reads, so what the model
  // is told and what the screen shows are one account of the week.
  const habits = await loadHabitFacts(today);
  const activityStats: ActivityInsightStat[] = habits.map((habit) => ({
    name: habit.name,
    targetPerDay: habit.figures.target,
    completedDays: habit.figures.daysDone,
    totalDays: habit.figures.daysActive,
    streak: habit.figures.streak,
  }));

  const totalPossible = activityStats.reduce((sum, a) => sum + a.totalDays, 0);
  const totalCompleted = activityStats.reduce(
    (sum, a) => sum + a.completedDays,
    0
  );
  const completionRate =
    totalPossible > 0
      ? Math.round((totalCompleted / totalPossible) * 100) / 100
      : 0;

  const journalEntries = await db.journalEntries
    .where("entry_date")
    .between(startStr, today, true, true)
    .filter((e) => !e.deleted_at)
    .toArray();
  const latestJournal = journalEntries
    .slice()
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))[0];

  return {
    // Habits cover the seven full days before today; the journal, seven days ending today.
    range: `${RANGE_DAYS}d`,
    activities: activityStats,
    journal: {
      entriesThisWeek: journalEntries.filter((e) =>
        Boolean(e.text_content?.trim())
      ).length,
      streak: latestJournal
        ? await journalStreakAsOf(latestJournal.entry_date)
        : 0,
      bookmarkedCount: journalEntries.filter((e) => e.is_bookmarked).length,
    },
    completionRate,
  };
}

/** Stable string used to detect whether the underlying stats actually changed. */
export function fingerprintPayload(payload: InsightPayload): string {
  return JSON.stringify(payload);
}

/**
 * The figures an insight was made from, recovered from its fingerprint (which
 * is the payload as JSON). Lets Home show exactly what was sent without storing
 * it twice. Null when the fingerprint is not a payload.
 */
export function parseInsightFigures(
  fingerprint: string
): InsightPayload | null {
  try {
    const value = JSON.parse(fingerprint) as Partial<InsightPayload> | null;
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray(value.activities) ||
      typeof value.completionRate !== "number" ||
      typeof value.journal?.streak !== "number" ||
      typeof value.range !== "string"
    ) {
      return null;
    }
    return value as InsightPayload;
  } catch {
    return null;
  }
}
