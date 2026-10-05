import { db } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import { fromDateString, shiftDate, toDateString } from "@/lib/time-utils";

/**
 * A journal day is complete when it has an emoji, a title, and text. Derived
 * from content, never from a stored flag, so backfilling or editing any day
 * heals the streak with nothing to propagate.
 */
export function isJournalEntryComplete(
  entry: Pick<JournalEntry, "day_emoji" | "title" | "text_content"> &
    Partial<Pick<JournalEntry, "deleted_at">>
): boolean {
  return Boolean(
    !entry.deleted_at &&
    entry.day_emoji?.trim() &&
    entry.title?.trim() &&
    entry.text_content?.trim()
  );
}

/**
 * Consecutive complete days ending on `date`. Zero when `date` itself is not
 * complete, so the UI shows a streak only on a completed day.
 */
export function journalStreakEndingOn(
  date: string,
  completeDates: ReadonlySet<string>
): number {
  let streak = 0;
  let cursor = fromDateString(date);
  while (completeDates.has(toDateString(cursor))) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/** Dates of every complete journal entry on this device. */
export async function loadCompleteJournalDates(): Promise<Set<string>> {
  const entries = await db.journalEntries.toArray();
  return new Set(
    entries.filter(isJournalEntryComplete).map((entry) => entry.entry_date)
  );
}

/** The single streak implementation: the Journal UI and the AI payload call it. */
export async function journalStreakAsOf(date: string): Promise<number> {
  return journalStreakEndingOn(date, await loadCompleteJournalDates());
}
