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
 * Returns the next login streak value and persists it.
 * - If lastDate was yesterday → increment
 * - If lastDate is today → return current streak unchanged (already counted)
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

  const yesterday = toDateString(new Date(new Date(today + "T00:00:00").getTime() - 86400000));
  const next = lastDate === yesterday ? current + 1 : 1;
  saveLoginStreak(next);
  return next;
}
