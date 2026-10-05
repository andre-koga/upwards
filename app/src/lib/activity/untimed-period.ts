import { db } from "@/lib/db";
import type { ActivityPeriod } from "@/lib/db/types";
import { sessionsOnDay } from "@/lib/activity/period-day-utils";
import { fromDateString, shiftDate, toDateString } from "@/lib/time-utils";

/** Closed period whose start and end are the same instant — a completion, not a span. */
export function isUntimedPeriod(
  startTime: string,
  endTime: string | null | undefined
): boolean {
  if (!endTime) return false;
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  return Number.isFinite(startMs) && startMs === endMs;
}

export async function fetchActivityPeriodsForDay(
  dateString: string
): Promise<ActivityPeriod[]> {
  // A session is linked to the entry of the day it started, so one that
  // crosses midnight onto this day lives on the previous day's entry.
  const base = fromDateString(dateString);
  const datesToQuery = [-1, 0, 1].map((offset) =>
    toDateString(shiftDate(base, offset))
  );
  const entries = await db.dailyEntries
    .where("date")
    .anyOf(datesToQuery)
    .filter((entry) => !entry.deleted_at)
    .toArray();
  if (entries.length === 0) return [];

  const entryIds = new Set(entries.map((entry) => entry.id));
  const dateEntryIds = new Set(
    entries
      .filter((entry) => entry.date === dateString)
      .map((entry) => entry.id)
  );
  const nowMs = Date.now();
  const candidates = await db.activityPeriods
    .filter(
      (period) =>
        !period.deleted_at &&
        !!period.daily_entry_id &&
        entryIds.has(period.daily_entry_id)
    )
    .toArray();

  const byId = new Map<string, ActivityPeriod>();
  for (const period of sessionsOnDay(candidates, dateString, nowMs)) {
    byId.set(period.id, period);
  }
  // Untimed rows can miss interval overlap when stamped with `now()` on a
  // past day. Still include them when they belong to that day's entry.
  for (const period of candidates) {
    if (!isUntimedPeriod(period.start_time, period.end_time)) continue;
    if (!dateEntryIds.has(period.daily_entry_id)) continue;
    byId.set(period.id, period);
  }

  return [...byId.values()].sort(
    (left, right) =>
      new Date(left.start_time).getTime() - new Date(right.start_time).getTime()
  );
}
