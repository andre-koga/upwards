import { loadHabitFacts } from "@/lib/ai/habit-facts";
import {
  isJournalEntryComplete,
  journalStreakEndingOn,
} from "@/lib/journal/streak";
import { db } from "@/lib/db";
import { fromDateString, shiftDate, toDateString } from "@/lib/time-utils";
import { buildDigest, type DigestItem } from "./digest";

export interface HomeDigest {
  items: DigestItem[];
  /** How many habits the digest read, so "nothing to act on" can be told from "nothing yet". */
  trackedHabits: number;
}

/**
 * The digest for `today`, read from this device from the same habit facts the
 * AI insight is made from (`loadHabitFacts`). A streak here is the one going
 * into today: the days up to yesterday that today's check would extend.
 */
export async function loadHomeDigest(today: string): Promise<HomeDigest> {
  const [habits, journalEntries] = await Promise.all([
    loadHabitFacts(today),
    db.journalEntries.toArray(),
  ]);

  const completeDates = new Set(
    journalEntries.filter(isJournalEntryComplete).map((e) => e.entry_date)
  );
  const journal = {
    writtenToday: completeDates.has(today),
    streakBeforeToday: journalStreakEndingOn(
      toDateString(shiftDate(fromDateString(today), -1)),
      completeDates
    ),
  };

  return {
    items: buildDigest({ habits, journal }),
    trackedHabits: habits.filter((habit) => habit.figures.type === "habit")
      .length,
  };
}
