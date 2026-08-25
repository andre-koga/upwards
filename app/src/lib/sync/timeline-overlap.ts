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

export async function maybeRecordTimelineOverlapInfo(
  dailyEntryId: string,
  activityId: string
): Promise<void> {
  const periods = await db.activityPeriods
    .where("daily_entry_id")
    .equals(dailyEntryId)
    .filter(
      (row) =>
        row.activity_id === activityId &&
        !row.deleted_at &&
        Boolean(row.start_time)
    )
    .toArray();

  if (periods.length < 2) return;

  let hasOverlap = false;
  for (let i = 0; i < periods.length; i += 1) {
    for (let j = i + 1; j < periods.length; j += 1) {
      if (periodsOverlap(periods[i], periods[j])) {
        hasOverlap = true;
        break;
      }
    }
    if (hasOverlap) break;
  }

  if (!hasOverlap) return;

  const existing = await db.syncIssues
    .filter(
      (issue) =>
        issue.kind === "info" &&
        issue.status === "open" &&
        issue.entity_type === "activity_period" &&
        issue.entity_id === `${dailyEntryId}:${activityId}`
    )
    .first();
  if (existing) return;

  await recordSyncIssue({
    kind: "info",
    title: "Overlapping timeline sessions",
    detail:
      "Two or more timed sessions for the same activity overlap on this day. Review your timeline and edit or remove sessions if needed.",
    entity_type: "activity_period",
    entity_id: `${dailyEntryId}:${activityId}`,
    account_id: getCachedUserId(),
  });
}
