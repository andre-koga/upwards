import { db, now } from "@/lib/db";
import type { JournalEntry, LocationData } from "@/lib/db/types";
import { shiftDate, toDateString } from "@/lib/time-utils";

/**
 * Parse stored location — handles legacy plain-string values gracefully.
 */
export function parseLocation(raw: unknown): LocationData | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return {
      displayName: raw,
      city: raw,
      state: null,
      country: null,
      countryCode: null,
      lat: null,
      lon: null,
    };
  }
  return raw as LocationData;
}

export interface JournalFields {
  title: string | null;
  text_content: string | null;
  day_emoji: string | null;
  is_bookmarked: boolean;
  video_path: string | null;
  location: LocationData | null;
  video_thumbnail: string | null;
}

export interface JournalCompletionMetadata {
  is_journal_complete: boolean;
  journal_entry_number: number | null;
  journal_completion_streak: number | null;
  journal_completed_at: string | null;
}

function hasRequiredJournalFields(fields: JournalFields): boolean {
  return Boolean(
    fields.day_emoji?.trim() &&
    fields.title?.trim() &&
    fields.text_content?.trim() &&
    fields.video_path?.trim()
  );
}

/**
 * Compute completion metadata for a journal entry.
 */
export async function getCompletionMetadata(
  dateStr: string,
  fields: JournalFields,
  existing: JournalEntry | undefined,
  timestamp: string
): Promise<JournalCompletionMetadata> {
  const existingIsComplete = !!existing?.is_journal_complete;

  if (!hasRequiredJournalFields(fields)) {
    return {
      is_journal_complete: false,
      journal_entry_number: existing?.journal_entry_number ?? null,
      journal_completion_streak: existing?.journal_completion_streak ?? null,
      journal_completed_at: existing?.journal_completed_at ?? null,
    };
  }

  if (existingIsComplete) {
    return {
      is_journal_complete: true,
      journal_entry_number: existing?.journal_entry_number ?? null,
      journal_completion_streak: existing?.journal_completion_streak ?? null,
      journal_completed_at: existing?.journal_completed_at ?? null,
    };
  }

  const yesterday = toDateString(shiftDate(new Date(`${dateStr}T00:00:00`), -1));
  const yesterdayEntry = await db.journalEntries
    .where("entry_date")
    .equals(yesterday)
    .filter((entry) => !entry.deleted_at)
    .first();

  const previousStreak = yesterdayEntry?.is_journal_complete
    ? (yesterdayEntry.journal_completion_streak ?? 0)
    : 0;

  const completedEntries = await db.journalEntries
    .filter(
      (entry) =>
        !entry.deleted_at &&
        !!entry.is_journal_complete &&
        typeof entry.journal_entry_number === "number"
    )
    .toArray();

  const maxEntryNumber = completedEntries.reduce(
    (max, entry) => Math.max(max, entry.journal_entry_number ?? 0),
    0
  );

  return {
    is_journal_complete: true,
    journal_entry_number: maxEntryNumber + 1,
    journal_completion_streak: previousStreak + 1,
    journal_completed_at: timestamp,
  };
}

/**
 * Recompute `journal_completion_streak` for this date and each following calendar day
 * that has a complete journal entry. Call after saving a day so that completing or
 * editing an earlier day updates streaks that were computed when the prior day was
 * still incomplete (e.g. today completed before yesterday).
 */
export async function propagateJournalCompletionStreaksAfterSave(
  savedDateStr: string
): Promise<void> {
  const timestamp = now();
  let cursor = toDateString(shiftDate(new Date(`${savedDateStr}T00:00:00`), 1));

  while (true) {
    const entry = await db.journalEntries
      .where("entry_date")
      .equals(cursor)
      .filter((e) => !e.deleted_at)
      .first();

    if (!entry?.is_journal_complete) break;

    const yesterday = toDateString(shiftDate(new Date(`${cursor}T00:00:00`), -1));
    const yesterdayEntry = await db.journalEntries
      .where("entry_date")
      .equals(yesterday)
      .filter((e) => !e.deleted_at)
      .first();

    const previousStreak = yesterdayEntry?.is_journal_complete
      ? (yesterdayEntry.journal_completion_streak ?? 0)
      : 0;
    const newStreak = previousStreak + 1;

    if (entry.journal_completion_streak !== newStreak) {
      await db.journalEntries.update(entry.id, {
        journal_completion_streak: newStreak,
        updated_at: timestamp,
      });
    }

    cursor = toDateString(shiftDate(new Date(`${cursor}T00:00:00`), 1));
  }
}
