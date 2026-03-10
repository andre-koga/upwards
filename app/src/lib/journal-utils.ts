import { db, toDateStr } from "@/lib/db";
import type { JournalEntry, LocationData } from "@/lib/db/types";
import { addDays } from "@/lib/date-utils";

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
  youtube_url: string | null;
  location: LocationData | null;
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
    fields.youtube_url?.trim()
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

  const yesterday = toDateStr(addDays(new Date(`${dateStr}T00:00:00`), -1));
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
