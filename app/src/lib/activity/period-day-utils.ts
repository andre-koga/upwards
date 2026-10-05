import type { ActivityPeriod } from "@/lib/db/types";

/**
 * Local midnights bounding a calendar date. Uses calendar arithmetic, never
 * `start + 24h`, so a DST day is 23 or 25 hours long.
 */
export function dayBoundsMs(dateStr: string): {
  startMs: number;
  endMs: number;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  return {
    startMs: new Date(y, (m || 1) - 1, d || 1).getTime(),
    endMs: new Date(y, (m || 1) - 1, (d || 1) + 1).getTime(),
  };
}

/**
 * The time a session spent on a calendar day:
 * `min(end ?? now, dayEnd) − max(start, dayStart)`, never negative.
 * Sessions are stored whole and never split; shares across days add up to the
 * full duration.
 */
export function sessionShareOfDay(
  startMs: number,
  endMs: number | null,
  dateStr: string,
  nowMs: number
): number {
  const day = dayBoundsMs(dateStr);
  const clippedStart = Math.max(startMs, day.startMs);
  const clippedEnd = Math.min(endMs ?? nowMs, day.endMs);
  return Math.max(0, clippedEnd - clippedStart);
}

/**
 * The sessions that appear on a calendar day: `start < dayEnd && (end ?? now)
 * > dayStart`. A session crossing midnight appears on both days.
 */
export function sessionsOnDay<
  T extends Pick<ActivityPeriod, "start_time" | "end_time" | "deleted_at">,
>(sessions: T[], dateStr: string, nowMs: number): T[] {
  const day = dayBoundsMs(dateStr);
  return sessions.filter((session) => {
    if (session.deleted_at) return false;
    const startMs = new Date(session.start_time).getTime();
    const endMs = session.end_time
      ? new Date(session.end_time).getTime()
      : null;
    // ponytail: legacy zero-length rows are instants, so they need a
    // half-open check. The A6 migration folds them into completion times,
    // after which this branch can go.
    if (endMs != null && startMs === endMs) {
      return startMs >= day.startMs && startMs < day.endMs;
    }
    return startMs < day.endMs && (endMs ?? nowMs) > day.startMs;
  });
}
