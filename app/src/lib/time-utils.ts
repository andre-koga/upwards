import { getActiveLocaleTag } from "@/lib/i18n";

/**
 * Parse YYYY-MM-DD string to Date (local time).
 */
export function fromDateString(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * Format Date to YYYY-MM-DD string.
 */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format Date for display (e.g. "Jan 15"), using the active app locale.
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(getActiveLocaleTag(), {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format Date as weekday + short month/day (e.g. "Mon, Jan 15"), using the active app locale.
 */
export function formatWeekdayShortDate(date: Date): string {
  return date.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format an ISO instant as a day clock time with AM/PM at the end
 * (e.g. "08:32:05 AM"), matching the time-field display.
 */
export function formatClockTime(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return "";
  const hours24 = date.getHours();
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${String(hour12).padStart(2, "0")}:${minutes}:${seconds} ${meridiem}`;
}

/**
 * Format ISO time string to HH:MM:SS for time input.
 */
export function formatTimeInput(isoTime: string | null): string {
  if (!isoTime) return "";
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format sync timestamp for compact UI surfaces.
 */
export function formatSyncTime(
  isoTime: string | null,
  fallback = "Never"
): string {
  if (!isoTime) return fallback;
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString(getActiveLocaleTag());
}

/**
 * Combine date and HH:MM:SS time string into ISO string.
 */
export function combineDateAndTime(date: Date, time: string): string {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const nextDate = new Date(date);
  nextDate.setHours(hours || 0, minutes || 0, seconds || 0, 0);
  return nextDate.toISOString();
}

/**
 * Add days to a date.
 */
export function shiftDate(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

/**
 * Get start of day (midnight) for a date.
 */
export function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** End of local calendar day for inclusive as-of comparisons. */
export function endOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(23, 59, 59, 999);
  return day;
}

/**
 * Convert HH:MM:SS time string to total seconds.
 */
export function timeToSeconds(time: string): number {
  if (!time) return 0;
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
}

/**
 * Helper: today as YYYY-MM-DD (local time).
 */
export function todayDateString(): string {
  // Inline effective-day logic to avoid circular dep with day-reset.ts
  const resetMin = (() => {
    const raw = localStorage.getItem("okhabit:day_reset_minutes");
    if (!raw) return 240;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 0 || n > 480 ? 240 : n;
  })();
  const now = new Date();
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
