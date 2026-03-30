import { db, now, newId } from "@/lib/db";
import type { DailyEntry } from "@/lib/db/types";

/**
 * Get or create a daily entry for the given date.
 * Returns the existing entry if found, otherwise creates a new one.
 */
export async function getOrCreateDailyEntry(
  dateString: string
): Promise<DailyEntry> {
  const existing = await db.dailyEntries
    .where("date")
    .equals(dateString)
    .filter((e) => !e.deleted_at)
    .first();

  if (existing) return existing;

  const n = now();
  const newEntry: DailyEntry = {
    id: newId(),
    date: dateString,
    task_counts: {},
    paused_task_ids: [],
    is_break_day: false,
    current_activity_id: null,
    created_at: n,
    updated_at: n,
    synced_at: null,
    deleted_at: null,
  };

  await db.dailyEntries.add(newEntry);
  return newEntry;
}
