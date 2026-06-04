/**
 * NOTE: DB-level period splitting has been removed.
 *
 * The app no longer splits activity periods in the database when they cross a
 * day-reset boundary.  All splitting is UI-only: periods are stored as single
 * records regardless of their duration, and the frontend clips them to the
 * effective day when computing elapsed time and rendering the timeline.
 *
 * The only remaining public export is `splitPeriodsAtDayReset`, kept as a
 * harmless no-op so any callers that haven't been cleaned up yet don't crash.
 */

/** @deprecated No-op. DB-level splitting has been removed. */
export async function splitPeriodsAtDayReset(): Promise<boolean> {
  return false;
}
