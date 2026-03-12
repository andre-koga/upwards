import { db, now } from "@/lib/db";

const MIN_SESSION_DURATION_MS = 5000;

/**
 * Close all open (no end_time) memo periods for the given daily entry.
 * Periods shorter than MIN_SESSION_DURATION_MS are soft-deleted.
 */
export async function closeOpenMemoPeriods(entryId: string): Promise<void> {
  const n = now();
  const openPeriods = await db.memoPeriods
    .where("daily_entry_id")
    .equals(entryId)
    .filter((p) => !p.end_time && !p.deleted_at)
    .toArray();

  if (openPeriods.length === 0) return;

  await Promise.all(
    openPeriods.map((period) => {
      const sessionDurationMs =
        new Date(n).getTime() - new Date(period.start_time).getTime();

      if (sessionDurationMs < MIN_SESSION_DURATION_MS) {
        return db.memoPeriods.update(period.id, {
          end_time: n,
          updated_at: n,
          deleted_at: n,
        });
      }

      return db.memoPeriods.update(period.id, {
        end_time: n,
        updated_at: n,
      });
    })
  );
}
