import { toDateString } from "@/lib/time-utils";

const DAY_RESET_MINUTES_KEY = "okhabit:day_reset_minutes";

/** Returns the configured day-reset offset in minutes past midnight (default 240 = 4 AM). */
export function getDayResetMinutes(): number {
  const raw = localStorage.getItem(DAY_RESET_MINUTES_KEY);
  if (!raw) return 240;
  const n = parseInt(raw, 10);
  return isNaN(n) || n < 0 || n > 480 ? 240 : n;
}

/** Persists a new day-reset offset (0–480 minutes past midnight). */
export function setDayResetMinutes(minutes: number): void {
  const clamped = Math.max(0, Math.min(480, Math.round(minutes)));
  localStorage.setItem(DAY_RESET_MINUTES_KEY, String(clamped));
}

/**
 * Returns the effective logical date string (YYYY-MM-DD) for the given instant.
 *
 * If the wall-clock time is before the configured reset minute, the logical day
 * is still the previous calendar day — so a 2 AM reset means 1:30 AM on Jan 2
 * still counts as Jan 1.
 */
export function getEffectiveToday(now = new Date()): string {
  const resetMin = getDayResetMinutes();
  if (resetMin > 0) {
    const currentMin = now.getHours() * 60 + now.getMinutes();
    if (currentMin < resetMin) {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 1);
      return toDateString(prev);
    }
  }
  return toDateString(now);
}

/**
 * Returns the wall-clock Date of the next day-reset boundary after the given instant.
 * Used to schedule a live reset timer.
 */
export function getNextResetTime(now = new Date()): Date {
  const resetMin = getDayResetMinutes();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const resetHour = Math.floor(resetMin / 60);
  const resetMinute = resetMin % 60;

  const next = new Date(now);
  next.setSeconds(0, 0);

  if (resetMin === 0 || currentMin >= resetMin) {
    // Reset is tomorrow at the configured time
    next.setDate(next.getDate() + 1);
  }
  next.setHours(resetHour, resetMinute, 0, 0);
  return next;
}

/** Human-readable label for a minutes-since-midnight value (e.g. 150 → "2:30 AM"). */
export function formatResetMinutes(minutes: number): string {
  if (minutes === 0) return "Midnight";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

/** All valid reset options in 1-hour increments from midnight to 8 AM. */
export const DAY_RESET_OPTIONS: { minutes: number; label: string }[] = Array.from(
  { length: 9 },
  (_, i) => ({ minutes: i * 60, label: formatResetMinutes(i * 60) })
);
