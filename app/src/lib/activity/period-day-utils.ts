import { getDayResetMinutes, getEffectiveToday } from "@/lib/session/day-reset";

/**
 * Returns the start-of-effective-day (the reset boundary that begins the
 * given logical date) as a ms timestamp.
 *
 * For midnight reset: the calendar midnight of dateStr.
 * For a 2 AM reset: 2:00 AM on the calendar day of dateStr.
 */
export function effectiveDayStartMs(dateStr: string): number {
  const resetMin = getDayResetMinutes();
  const [y, m, d] = dateStr.split("-").map(Number);
  const boundary = new Date(y, (m || 1) - 1, d || 1);
  boundary.setHours(Math.floor(resetMin / 60), resetMin % 60, 0, 0);
  return boundary.getTime();
}

/**
 * Returns the end-of-effective-day (exclusive: the next reset boundary) as
 * a ms timestamp.
 */
export function effectiveDayEndMs(dateStr: string): number {
  const startMs = effectiveDayStartMs(dateStr);
  // One full day (24 h) later
  return startMs + 24 * 60 * 60 * 1000;
}

/**
 * Given an activity period, returns the portion of its duration that falls
 * within the effective day identified by dateStr, capped to [dayStart, dayEnd).
 *
 * - endMs === null → the period is still running; uses `nowMs` as the end.
 * - Returns 0 if the period does not overlap the effective day at all.
 */
export function clipPeriodToDay(
  startMs: number,
  endMs: number | null,
  dateStr: string,
  nowMs: number
): number {
  const dayStart = effectiveDayStartMs(dateStr);
  const dayEnd = effectiveDayEndMs(dateStr);
  const periodEnd = endMs ?? nowMs;

  const clippedStart = Math.max(startMs, dayStart);
  const clippedEnd = Math.min(periodEnd, dayEnd);
  return Math.max(0, clippedEnd - clippedStart);
}

/**
 * Returns true if a period [startMs, endMs) overlaps the effective day for
 * dateStr.  endMs === null means still running (use nowMs as end).
 */
export function periodOverlapsDay(
  startMs: number,
  endMs: number | null,
  dateStr: string,
  nowMs: number
): boolean {
  return clipPeriodToDay(startMs, endMs, dateStr, nowMs) > 0;
}

/**
 * Returns the effective logical date string for the start of a period.
 * Delegates to getEffectiveToday but with a specific instant.
 */
export function effectiveDateForMs(ms: number): string {
  return getEffectiveToday(new Date(ms));
}
