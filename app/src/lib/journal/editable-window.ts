import { toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";

/**
 * How far back from the current effective today the journal and aligned day
 * views remain editable (inclusive of the oldest day).
 */
export const JOURNAL_EDITABLE_DAY_LOOKBACK = 7;

export function isJournalCalendarDateEditable(
  viewedDate: Date,
  referenceNow: Date = new Date()
): boolean {
  const todayMidnight = new Date(toDateString(referenceNow) + "T00:00:00");
  const entryMidnight = new Date(toDateString(viewedDate) + "T00:00:00");
  const diffDays = Math.floor(
    (todayMidnight.getTime() - entryMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays >= 0 && diffDays <= JOURNAL_EDITABLE_DAY_LOOKBACK;
}

/**
 * Whether timeline sessions and For Today task interactions on the given date
 * string are editable. Uses the configured day-reset boundary for "today" and
 * allows up to 7 days back, matching the journal window.
 */
export function isActivityDateEditable(
  dateString: string,
  referenceNow: Date = new Date()
): boolean {
  const todayStr = getEffectiveToday(referenceNow);
  const todayMidnight = new Date(todayStr + "T00:00:00");
  const entryMidnight = new Date(dateString + "T00:00:00");
  const diffDays = Math.floor(
    (todayMidnight.getTime() - entryMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays >= 0 && diffDays <= JOURNAL_EDITABLE_DAY_LOOKBACK;
}
