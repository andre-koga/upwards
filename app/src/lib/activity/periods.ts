import { db, now } from "@/lib/db";
import { patchTimedPeriod } from "@/lib/sync/mutate-synced";

const MIN_SESSION_DURATION_MS = 5000;

/**
 * Close all open (no end_time) activity periods for the given daily entry.
 *
 * A period under MIN_SESSION_DURATION_MS is treated as an accidental tap and
 * soft-deleted. That tombstone is pushed to every device, so the test guarding it
 * has to be exact — in production, 88 of 143 deleted activity_periods were under
 * five seconds, which is this code's signature rather than any user delete.
 *
 * Two things it must not do:
 *
 * - Delete a session because the clock moved. `Date.now()` is not monotonic: an
 *   NTP step, a manual timezone/clock change, or a device waking from sleep can
 *   put it behind `start_time`, making the duration negative. Negative is `< 5s`,
 *   so a session running for an hour got tombstoned and the tombstone synced out.
 * - Delete a period carrying a note, which is user-authored content regardless of
 *   how brief the session was.
 */
export async function closeOpenPeriods(entryId: string): Promise<void> {
  const n = now();
  const openPeriods = await db.activityPeriods
    .where("daily_entry_id")
    .equals(entryId)
    .filter((p) => !p.end_time && !p.deleted_at)
    .toArray();

  if (openPeriods.length === 0) return;

  await Promise.all(
    openPeriods.map((period) => {
      const sessionDurationMs =
        new Date(n).getTime() - new Date(period.start_time).getTime();

      if (sessionDurationMs < 0) {
        // The clock moved backwards, so the real duration is unknowable. Close it
        // as a zero-length period, which is the app's existing representation for
        // "this happened, with no duration" (see isUntimedPeriod). Writing
        // end_time = n instead would leave end before start; keeping it open would
        // let it run concurrently with the next session.
        return patchTimedPeriod(period.id, {
          end_time: period.start_time,
          updated_at: n,
        });
      }

      const isAccidentalTap =
        sessionDurationMs < MIN_SESSION_DURATION_MS &&
        !(period.note && period.note.trim().length > 0);

      if (isAccidentalTap) {
        return patchTimedPeriod(period.id, {
          end_time: n,
          updated_at: n,
          deleted_at: n,
        });
      }

      return patchTimedPeriod(period.id, {
        end_time: n,
        updated_at: n,
      });
    })
  );
}
