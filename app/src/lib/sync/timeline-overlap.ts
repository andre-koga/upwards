import { db } from "@/lib/db";
import type { ActivityPeriod } from "@/lib/db/types";
import { recordSyncIssue } from "@/lib/sync/sync-issues-store";
import { getCachedUserId } from "@/lib/supabase";

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function periodsOverlap(a: ActivityPeriod, b: ActivityPeriod): boolean {
  const aStart = parseMs(a.start_time);
  const bStart = parseMs(b.start_time);
  if (aStart == null || bStart == null) return false;

  const aEnd = parseMs(a.end_time) ?? aStart;
  const bEnd = parseMs(b.end_time) ?? bStart;
  if (aEnd <= aStart || bEnd <= bStart) return false;

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Record an info issue when `period` overlaps another session of the same
 * activity. Sessions are compared by their own times: nothing groups them by
 * day, so the issue is keyed by the activity and the day the session started.
 */
export async function maybeRecordTimelineOverlapInfo(
  period: ActivityPeriod
): Promise<void> {
  if (period.deleted_at || !period.start_time) return;

  const others = await db.activityPeriods
    .where("activity_id")
    .equals(period.activity_id)
    .filter((row) => row.id !== period.id && !row.deleted_at)
    .toArray();
  if (!others.some((other) => periodsOverlap(period, other))) return;

  const issueKey = `${period.activity_id}:${period.start_time.slice(0, 10)}`;
  const existing = await db.syncIssues
    .filter(
      (issue) =>
        issue.kind === "info" &&
        issue.status === "open" &&
        issue.entity_type === "activity_period" &&
        issue.entity_id === issueKey
    )
    .first();
  if (existing) return;

  await recordSyncIssue({
    kind: "info",
    title: "Overlapping timeline sessions",
    detail:
      "Two or more timed sessions for the same activity overlap. Review your timeline and edit or remove sessions if needed.",
    entity_type: "activity_period",
    entity_id: issueKey,
    account_id: getCachedUserId(),
  });
}
