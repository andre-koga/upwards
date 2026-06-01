import { db, newId, now } from "@/lib/db";
import { toDateString } from "@/lib/time-utils";
import { getDayResetMinutes } from "@/lib/session/day-reset";
import { getOrCreateDailyEntry } from "@/lib/db/daily-entry";

/**
 * Returns the wall-clock Date representing the reset boundary for a given
 * calendar date string (YYYY-MM-DD) at the configured reset offset.
 */
function resetBoundaryForDate(dateStr: string): Date {
  const resetMin = getDayResetMinutes();
  const [y, m, d] = dateStr.split("-").map(Number);
  const boundary = new Date(y, (m || 1) - 1, d || 1);
  // The "next day's reset" falls on the next calendar day at resetMin
  boundary.setDate(boundary.getDate() + 1);
  boundary.setHours(Math.floor(resetMin / 60), resetMin % 60, 0, 0);
  return boundary;
}

/**
 * Walk the reset boundaries between startMs and nowMs in chronological order.
 * Returns all boundary timestamps that fall in the open interval (startMs, nowMs).
 */
function collectBoundaries(startMs: number, nowMs: number): number[] {
  const resetMin = getDayResetMinutes();
  if (resetMin === 0) {
    // Midnight boundaries: every calendar date change
    const boundaries: number[] = [];
    const cursor = new Date(startMs);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1); // first midnight after start
    while (cursor.getTime() < nowMs) {
      boundaries.push(cursor.getTime());
      cursor.setDate(cursor.getDate() + 1);
    }
    return boundaries;
  }

  const boundaries: number[] = [];
  const cursor = new Date(startMs);
  // Find the first reset boundary strictly after startMs
  cursor.setHours(Math.floor(resetMin / 60), resetMin % 60, 0, 0);
  if (cursor.getTime() <= startMs) cursor.setDate(cursor.getDate() + 1);

  while (cursor.getTime() < nowMs) {
    boundaries.push(cursor.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return boundaries;
}

/**
 * Finds every open ActivityPeriod (end_time: null) whose start_time is before
 * the current effective reset boundary and splits it across day boundaries.
 *
 * For each boundary:
 *   - Close the old period at the boundary timestamp.
 *   - Create a new period on the new day's DailyEntry starting at the boundary.
 *
 * If the timer spans multiple boundaries (app was closed for >1 day), all gaps
 * are handled in sequence.
 *
 * Returns true if any periods were split (callers can use this to trigger a
 * UI refresh).
 */
export async function splitPeriodsAtDayReset(): Promise<boolean> {
  const openPeriods = await db.activityPeriods
    .filter((p) => !p.end_time && !p.deleted_at)
    .toArray();

  if (openPeriods.length === 0) return false;

  const nowMs = Date.now();
  let anySplit = false;

  for (const period of openPeriods) {
    const startMs = new Date(period.start_time).getTime();
    const boundaries = collectBoundaries(startMs, nowMs);
    if (boundaries.length === 0) continue;

    anySplit = true;
    let currentPeriodId = period.id;
    let currentEntryId = period.daily_entry_id;
    let currentActivityId = period.activity_id;
    let previousBoundaryMs = startMs;

    for (const boundaryMs of boundaries) {
      const boundaryIso = new Date(boundaryMs).toISOString();
      const n = now();

      // Close the current period at the boundary
      await db.activityPeriods.update(currentPeriodId, {
        end_time: boundaryIso,
        updated_at: n,
      });

      // Determine the new day's date string (boundary is the reset time on the
      // "new" calendar day, so the effective date is that calendar day).
      const newDayDate = new Date(boundaryMs);
      const newDateStr = toDateString(newDayDate);

      // Get or create the DailyEntry for the new day
      const newEntry = await getOrCreateDailyEntry(newDateStr);

      // Update the new day's current_activity_id
      await db.dailyEntries.update(newEntry.id, {
        current_activity_id: currentActivityId,
        updated_at: n,
      });

      // Create a new open period on the new day starting at the boundary
      const newPeriodId = newId();
      await db.activityPeriods.add({
        id: newPeriodId,
        daily_entry_id: newEntry.id,
        activity_id: currentActivityId,
        start_time: boundaryIso,
        end_time: null,
        created_at: n,
        updated_at: n,
        synced_at: null,
        deleted_at: null,
      });

      currentPeriodId = newPeriodId;
      currentEntryId = newEntry.id;
      previousBoundaryMs = boundaryMs;
    }

    // Clear current_activity_id on the original entry (it no longer owns the running period)
    if (currentEntryId !== period.daily_entry_id) {
      await db.dailyEntries
        .where("id")
        .equals(period.daily_entry_id)
        .modify((e) => { e.current_activity_id = null; });
    }
  }

  return anySplit;
}
