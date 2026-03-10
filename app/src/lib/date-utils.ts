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
 * Format Date for display (e.g. "Jan 15, 2025").
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

/** Alias for shiftDate for semantic clarity. */
export const addDays = shiftDate;

/**
 * Get start of day (midnight) for a date.
 */
export function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * Shift HH:MM:SS time string by delta minutes.
 */
export function shiftTimeByMinutes(time: string, deltaMinutes: number): string {
  if (!time) return "";
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const total = (hours * 60 + minutes + deltaMinutes + 24 * 60) % (24 * 60);
  const nextHours = String(Math.floor(total / 60)).padStart(2, "0");
  const nextMinutes = String(total % 60).padStart(2, "0");
  const nextSeconds = String(seconds).padStart(2, "0");
  return `${nextHours}:${nextMinutes}:${nextSeconds}`;
}

/**
 * Convert HH:MM:SS time string to total seconds.
 */
export function timeToSeconds(time: string): number {
  if (!time) return 0;
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
}
