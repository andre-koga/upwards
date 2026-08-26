import { db, now } from "@/lib/db";
import type { DailyEntry } from "@/lib/db/types";
import { naturalDailyEntryIdForDate } from "@/lib/sync/natural-ids";
import { withSuppressedProjectionEnqueue } from "@/lib/sync/projection-sync";

/**
 * Get or create the local daily-entry projection for a date.
 * Uses a deterministic id so every device agrees. This is not a synced upsert.
 */
export async function getOrCreateDailyEntry(
  dateString: string
): Promise<DailyEntry> {
  const existing = await db.dailyEntries
    .where("date")
    .equals(dateString)
    .filter((e) => !e.deleted_at)
    .first();

  if (existing) {
    if (!existing.completion_notes) existing.completion_notes = {};
    return existing;
  }

  const n = now();
  const newEntry: DailyEntry = {
    id: naturalDailyEntryIdForDate(dateString),
    date: dateString,
    task_counts: {},
    paused_task_ids: [],
    is_break_day: false,
    current_activity_id: null,
    completion_notes: {},
    created_at: n,
    updated_at: n,
    synced_at: null,
    deleted_at: null,
  };

  await withSuppressedProjectionEnqueue(async () => {
    const raced = await db.dailyEntries
      .where("date")
      .equals(dateString)
      .filter((e) => !e.deleted_at)
      .first();
    if (raced) return;
    try {
      await db.dailyEntries.add(newEntry);
    } catch {
      const after = await db.dailyEntries.get(newEntry.id);
      if (after) return;
      throw new Error("Failed to create daily entry");
    }
  });

  return (await db.dailyEntries.get(newEntry.id)) ?? newEntry;
}
