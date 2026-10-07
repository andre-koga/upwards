import { db, now } from "@/lib/db";
import type { ActivityPeriod } from "@/lib/db/types";
import { patchTimedPeriod } from "@/lib/sync/mutate-synced";
import { sessionsOnDay } from "@/lib/activity/period-day-utils";

const MIN_SESSION_DURATION_MS = 5000;

/**
 * Close every open (no end_time) activity period. Only one session runs at a
 * time, and a session belongs to no day: it is found by its own times.
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
export async function closeOpenPeriods(): Promise<void> {
  const n = now();
  // ponytail: scans the table, since null end times aren't indexed. Fine
  // while sessions number in the thousands; an `open` flag would fix it.
  const openPeriods = await db.activityPeriods
    .filter((p) => !p.end_time && !p.deleted_at)
    .toArray();

  if (openPeriods.length === 0) return;

  await Promise.all(
    openPeriods.map((period) => {
      const sessionDurationMs =
        new Date(n).getTime() - new Date(period.start_time).getTime();

      if (sessionDurationMs < 0) {
        // The clock moved backwards, so the real duration is unknowable. Close it
        // one second after it started: end must follow start, and a zero-length
        // session is no longer a valid shape (the cutover folded those into
        // completion times). Writing end_time = n would leave end before start;
        // keeping it open would let it run alongside the next session.
        return patchTimedPeriod(period.id, {
          end_time: new Date(
            new Date(period.start_time).getTime() + 1000
          ).toISOString(),
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

/**
 * Sessions that appear on a calendar day, found by their own times: a session
 * that crosses midnight appears on both days, and nothing links it to a
 * daily entry.
 */
export async function fetchActivityPeriodsForDay(
  dateString: string
): Promise<ActivityPeriod[]> {
  // ponytail: reads every session and filters in memory. The start_time and
  // end_time indexes are ready for a range query if this shows up in profiles.
  const all = await db.activityPeriods
    .filter((period) => !period.deleted_at)
    .toArray();
  return sessionsOnDay(all, dateString, Date.now()).sort(
    (left, right) =>
      new Date(left.start_time).getTime() - new Date(right.start_time).getTime()
  );
}
