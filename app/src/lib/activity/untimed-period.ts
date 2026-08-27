import { db } from "@/lib/db";
import type { ActivityPeriod } from "@/lib/db/types";
import {
  calendarDatesOverlappingEffectiveDay,
  periodBelongsToDay,
  resolvePeriodFromLogicalDay,
  timestampForLogicalDayTime,
} from "@/lib/activity/period-day-utils";
import { timeToSeconds } from "@/lib/time-utils";

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

export function periodsBelongingToDay(
  periods: ActivityPeriod[],
  dateString: string,
  nowMs: number
): ActivityPeriod[] {
  return periods.filter((period) => {
    if (period.deleted_at) return false;
    const startMs = new Date(period.start_time).getTime();
    const endMs = period.end_time ? new Date(period.end_time).getTime() : null;
    return periodBelongsToDay(startMs, endMs, dateString, nowMs);
  });
}

export type ClosedSessionTimesResult =
  | { ok: true; startIso: string; endIso: string }
  | { ok: false; error: "one_time" };

/**
 * Resolve start/end for a closed session.
 * Both empty → keep the existing completion instant (or created_at).
 * Start only, or same start and end → untimed completion at that clock time.
 * Different times → a timed span.
 */
export function resolveClosedSessionTimes(params: {
  startTime: string;
  endTime: string;
  logicalDateStr: string;
  resetMinutes: number;
  existingStartIso: string;
  existingEndIso: string | null;
  createdAt: string;
}): ClosedSessionTimesResult {
  const startEmpty = !params.startTime;
  const endEmpty = !params.endTime;

  if (startEmpty && endEmpty) {
    const completionIso = isUntimedPeriod(
      params.existingStartIso,
      params.existingEndIso
    )
      ? params.existingStartIso
      : params.createdAt;
    return { ok: true, startIso: completionIso, endIso: completionIso };
  }

  if (startEmpty) {
    return { ok: false, error: "one_time" };
  }

  if (endEmpty) {
    const completionMs = timestampForLogicalDayTime(
      params.logicalDateStr,
      params.startTime,
      params.resetMinutes
    );
    const completionIso = new Date(completionMs).toISOString();
    return { ok: true, startIso: completionIso, endIso: completionIso };
  }

  if (timeToSeconds(params.endTime) === timeToSeconds(params.startTime)) {
    const completionMs = timestampForLogicalDayTime(
      params.logicalDateStr,
      params.startTime,
      params.resetMinutes
    );
    const completionIso = new Date(completionMs).toISOString();
    return { ok: true, startIso: completionIso, endIso: completionIso };
  }

  const resolved = resolvePeriodFromLogicalDay(
    params.logicalDateStr,
    params.startTime,
    params.endTime,
    params.resetMinutes
  );
  return { ok: true, startIso: resolved.startIso, endIso: resolved.endIso };
}

export async function fetchActivityPeriodsForDay(
  dateString: string
): Promise<ActivityPeriod[]> {
  const datesToQuery = calendarDatesOverlappingEffectiveDay(dateString);
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
  for (const period of periodsBelongingToDay(candidates, dateString, nowMs)) {
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
