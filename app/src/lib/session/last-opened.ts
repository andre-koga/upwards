import { getEffectiveToday, getDayResetMinutes } from "@/lib/session/day-reset";
import { toDateString } from "@/lib/time-utils";

const LAST_OPENED_DATE_KEY = "okhabit:last_opened_date";
const LOGIN_STREAK_KEY = "okhabit:login_streak";

export function loadLastOpenedDate(): string | null {
  return localStorage.getItem(LAST_OPENED_DATE_KEY) ?? null;
}

export function saveLastOpenedDate(date: string): void {
  localStorage.setItem(LAST_OPENED_DATE_KEY, date);
}

export function loadLoginStreak(): number {
  const raw = localStorage.getItem(LOGIN_STREAK_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

function saveLoginStreak(streak: number): void {
  localStorage.setItem(LOGIN_STREAK_KEY, String(streak));
}

/**
 * Derive "the effective yesterday" by subtracting one logical day from the
 * effective today. The logical day boundary is aware of the configured reset
 * offset so that e.g. 1:30 AM (with a 2 AM reset) is still "yesterday".
 */
function effectiveYesterday(today: string): string {
  // Step back exactly 24 hours from the current reset boundary timestamp
  const resetMin = getDayResetMinutes();
  const [y, m, d] = today.split("-").map(Number);
  const todayResetBoundary = new Date(y, (m || 1) - 1, d || 1);
  todayResetBoundary.setHours(Math.floor(resetMin / 60), resetMin % 60, 0, 0);
  const yesterdayBoundary = new Date(todayResetBoundary.getTime() - 86400000);
  return toDateString(yesterdayBoundary);
}

/**
 * Returns the next login streak value and persists it.
 * - If lastDate was the previous effective day → increment
 * - If lastDate is today's effective day → return current streak unchanged
 * - Otherwise (gap or first open) → reset to 1
 */
export function computeAndSaveLoginStreak(
  lastDate: string | null,
  today: string
): number {
  const current = loadLoginStreak();

  if (!lastDate) {
    saveLoginStreak(1);
    return 1;
  }

  if (lastDate === today) {
    return current;
  }

  const yesterday = effectiveYesterday(today);
  const next = lastDate === yesterday ? current + 1 : 1;
  saveLoginStreak(next);
  return next;
}
