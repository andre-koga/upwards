import { getDayResetMinutes, getEffectiveToday } from "@/lib/session/day-reset";
import {
  combineDateAndTime,
  fromDateString,
  shiftDate,
  timeToSeconds,
  toDateString,
} from "@/lib/time-utils";

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

/**
 * Map a wall-clock time within a logical day to an absolute timestamp.
 * For paired start/end resolution, use resolvePeriodFromLogicalDay.
 */
export function timestampForLogicalDayTime(
  logicalDateStr: string,
  timeStr: string,
  resetMinutes = getDayResetMinutes()
): number {
  const resetSec = resetMinutes * 60;
  const timeSec = timeToSeconds(timeStr);
  const base = fromDateString(logicalDateStr);

  if (timeSec >= resetSec) {
    return new Date(combineDateAndTime(base, timeStr)).getTime();
  }
  return new Date(combineDateAndTime(shiftDate(base, 1), timeStr)).getTime();
}

export interface ResolvedPeriod {
  startMs: number;
  endMs: number;
  startIso: string;
  endIso: string;
}

/**
 * Build absolute period timestamps from a logical day plus start/end wall times.
 * The date field is the logical day the session is being added to; times may
 * fall on one or two calendar dates depending on the configured reset.
 */
export function resolvePeriodFromLogicalDay(
  logicalDateStr: string,
  startTime: string,
  endTime: string,
  resetMinutes = getDayResetMinutes()
): ResolvedPeriod {
  const resetSec = resetMinutes * 60;
  const startSec = timeToSeconds(startTime);
  const endSec = timeToSeconds(endTime);
  const base = fromDateString(logicalDateStr);

  let startDate: Date;
  let endDate: Date;

  if (startSec < resetSec && endSec < resetSec && endSec > startSec) {
    // Early-morning block entirely before reset → next calendar day.
    startDate = shiftDate(base, 1);
    endDate = shiftDate(base, 1);
  } else if (startSec < resetSec && endSec >= resetSec) {
    // Crosses reset on the same calendar date (e.g. 3 AM–6 AM).
    startDate = base;
    endDate = base;
  } else {
    startDate = base;
    endDate = base;
  }

  const startMs = new Date(combineDateAndTime(startDate, startTime)).getTime();
  let endMs = new Date(combineDateAndTime(endDate, endTime)).getTime();

  if (endMs <= startMs) {
    endMs = new Date(
      combineDateAndTime(shiftDate(endDate, 1), endTime)
    ).getTime();
  }

  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

/** Logical day of the last instant in [startMs, endMs). */
export function getLogicalEndDate(startMs: number, endMs: number): string {
  return effectiveDateForMs(Math.max(startMs, endMs - 1));
}

export function spansLogicalDays(startMs: number, endMs: number): boolean {
  return effectiveDateForMs(startMs) !== getLogicalEndDate(startMs, endMs);
}

/**
 * Calendar dates whose clock times overlap the effective-day window for
 * dateStr. Includes a ±bufferDays cushion for legacy daily_entry links.
 */
export function calendarDatesOverlappingEffectiveDay(
  dateStr: string,
  bufferDays = 1
): string[] {
  const dayStart = effectiveDayStartMs(dateStr);
  const dayEnd = effectiveDayEndMs(dateStr);
  const dates = new Set<string>();
  dates.add(toDateString(new Date(dayStart)));
  dates.add(toDateString(new Date(dayEnd - 1)));

  if (bufferDays > 0) {
    const anchor = new Date(dayStart);
    for (let offset = -bufferDays; offset <= bufferDays; offset++) {
      const d = new Date(anchor);
      d.setDate(d.getDate() + offset);
      dates.add(toDateString(d));
    }
  }

  return [...dates];
}
