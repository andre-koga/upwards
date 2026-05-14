import { toDateString } from "@/lib/time-utils";

/**
 * How far back from local midnight "today" the journal and aligned day views
 * remain editable for the selected calendar day (inclusive of that oldest day).
 */
export const JOURNAL_EDITABLE_DAY_LOOKBACK = 7;

export function isJournalCalendarDateEditable(
  viewedDate: Date,
  referenceNow: Date = new Date()
): boolean {
  const todayMidnight = new Date(toDateString(referenceNow) + "T00:00:00");
  const entryMidnight = new Date(toDateString(viewedDate) + "T00:00:00");
  const diffDays = Math.floor(
    (todayMidnight.getTime() - entryMidnight.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return (
    diffDays >= 0 && diffDays <= JOURNAL_EDITABLE_DAY_LOOKBACK
  );
}
