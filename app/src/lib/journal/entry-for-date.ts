import { db } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import { journalEntryHasContent } from "@/lib/journal/archive";
import { naturalJournalIdForDate } from "@/lib/sync/natural-ids";

/**
 * The journal row for a day.
 *
 * Every journal id is derived from (user, date), so a day has one row. The
 * exception is the moment after the A8b re-key: a device can still hold the
 * row under its old id until the next snapshot retires it (snapshot-sync.ts).
 * Reads prefer the natural id so a write lands on the row the server keeps;
 * nothing here merges or deletes.
 */
export async function journalEntryForDate(
  entryDate: string
): Promise<JournalEntry | null> {
  const entries = await db.journalEntries
    .where("entry_date")
    .equals(entryDate)
    .filter((entry) => !entry.deleted_at)
    .toArray();
  if (entries.length <= 1) return entries[0] ?? null;

  const naturalId = naturalJournalIdForDate(entryDate);
  return (
    entries.find((entry) => entry.id === naturalId) ??
    entries.reduce((latest, entry) =>
      entry.updated_at > latest.updated_at ? entry : latest
    )
  );
}

export function journalEntryFieldsHaveContent(
  fields: Pick<
    JournalEntry,
    | "title"
    | "text_content"
    | "day_emoji"
    | "video_path"
    | "photo_paths"
    | "location"
    | "is_bookmarked"
  >
): boolean {
  if (fields.is_bookmarked) return true;

  return journalEntryHasContent({
    id: "preview",
    entry_date: "1970-01-01",
    title: fields.title,
    text_content: fields.text_content,
    day_emoji: fields.day_emoji,
    is_bookmarked: fields.is_bookmarked,
    video_path: fields.video_path,
    video_thumbnail: null,
    photo_paths: fields.photo_paths,
    location: fields.location,
    created_at: "1970-01-01T00:00:00.000Z",
    updated_at: "1970-01-01T00:00:00.000Z",
    synced_at: null,
    deleted_at: null,
  });
}
