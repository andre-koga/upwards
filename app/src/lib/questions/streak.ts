import { dayNumber } from "./daily";

export interface Streaks {
  /** Days in a row ending today, or ending yesterday while today is still open. */
  current: number;
  best: number;
  answeredToday: boolean;
}

/**
 * Streaks from the days a question was answered. They are worked out here from
 * the answers themselves, so they follow the account to a new device and need
 * no row of their own.
 *
 * A streak is not shown as broken until the day it was missed has ended: if
 * today is not answered yet, it still counts back from yesterday.
 */
export function computeStreaks(
  answeredDates: readonly string[],
  today: string
): Streaks {
  const days = [...new Set(answeredDates.map(dayNumber))].sort((a, b) => a - b);
  const todayNumber = dayNumber(today);
  const answeredToday = days.includes(todayNumber);

  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of days) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  let current = 0;
  let cursor = answeredToday ? todayNumber : todayNumber - 1;
  const set = new Set(days);
  while (set.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, best, answeredToday };
}
