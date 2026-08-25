import { db, now, newId } from "@/lib/db";
import type { DailyEntry, SyncIssue } from "@/lib/db/types";
import { recordSyncIssue } from "@/lib/sync/sync-issues-store";
import { getCachedUserId } from "@/lib/supabase";

export interface DailyEntryCountReconciliationPayload {
  kind: "daily_entry_count_reconciliation";
  entity_id: string;
  date: string;
  local_counts: Record<string, number>;
  remote_counts: Record<string, number>;
  suggested_counts: Record<string, number>;
  differing_activities: string[];
  resolution?: {
    choice: "keep_local" | "keep_remote" | "use_suggested" | "defer";
    resolved_at: string;
  };
}

export function isDailyEntryCountReconciliationPayload(
  value: unknown
): value is DailyEntryCountReconciliationPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as DailyEntryCountReconciliationPayload).kind ===
      "daily_entry_count_reconciliation"
  );
}

function normalizeCounts(
  counts: Record<string, number> | null | undefined
): Record<string, number> {
  if (!counts) return {};
  const next: Record<string, number> = {};
  for (const [activityId, value] of Object.entries(counts)) {
    if (typeof value === "number" && value > 0) next[activityId] = value;
  }
  return next;
}

function suggestedMergedCounts(
  local: Record<string, number>,
  remote: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...remote };
  for (const [activityId, localCount] of Object.entries(local)) {
    const remoteCount = remote[activityId] ?? 0;
    merged[activityId] = Math.max(localCount, remoteCount);
  }
  return merged;
}

export function analyzeDailyEntryCountDrift(params: {
  before: Record<string, number>;
  after: Record<string, number>;
}): string[] {
  const differing: string[] = [];
  const keys = new Set([
    ...Object.keys(params.before),
    ...Object.keys(params.after),
  ]);
  for (const key of keys) {
    if ((params.before[key] ?? 0) !== (params.after[key] ?? 0)) {
      differing.push(key);
    }
  }
  return differing;
}

export async function maybeRecordDailyEntryCountReconciliation(params: {
  entryId: string;
  date: string;
  beforeCounts: Record<string, number>;
  afterCounts: Record<string, number>;
}): Promise<SyncIssue | null> {
  const local = normalizeCounts(params.beforeCounts);
  const remote = normalizeCounts(params.afterCounts);
  const differing = analyzeDailyEntryCountDrift({
    before: local,
    after: remote,
  });
  if (differing.length === 0) return null;

  const existing = await db.syncIssues
    .filter(
      (issue) =>
        issue.kind === "conflict" &&
        (issue.status === "open" || issue.status === "deferred") &&
        issue.entity_id === params.entryId &&
        isDailyEntryCountReconciliationPayload(issue.payload)
    )
    .first();
  if (existing) return existing;

  const payload: DailyEntryCountReconciliationPayload = {
    kind: "daily_entry_count_reconciliation",
    entity_id: params.entryId,
    date: params.date,
    local_counts: local,
    remote_counts: remote,
    suggested_counts: suggestedMergedCounts(local, remote),
    differing_activities: differing,
  };

  return recordSyncIssue({
    kind: "conflict",
    title: "Habit counts need review",
    detail: `Counts for ${params.date} differ between this device and the cloud.`,
    entity_type: "daily_entry",
    entity_id: params.entryId,
    payload,
    account_id: getCachedUserId(),
  });
}

export async function resolveDailyEntryCountReconciliation(
  issue: SyncIssue,
  choice: "keep_local" | "keep_remote" | "use_suggested"
): Promise<void> {
  if (!isDailyEntryCountReconciliationPayload(issue.payload)) {
    throw new Error("Missing daily entry count reconciliation payload");
  }

  const payload = issue.payload;
  const entry = await db.dailyEntries.get(payload.entity_id);
  if (!entry) throw new Error("Daily entry not found");

  let nextCounts: Record<string, number>;
  if (choice === "keep_local") nextCounts = { ...payload.local_counts };
  else if (choice === "keep_remote") nextCounts = { ...payload.remote_counts };
  else nextCounts = { ...payload.suggested_counts };

  const ts = now();
  await db.dailyEntries.update(entry.id, {
    task_counts: nextCounts,
    updated_at: ts,
  });

  await db.syncIssues.update(issue.id, {
    status: "resolved",
    resolved_at: ts,
    updated_at: ts,
    payload: {
      ...payload,
      resolution: { choice, resolved_at: ts },
    },
  });
}

export async function deferDailyEntryCountReconciliation(
  issue: SyncIssue
): Promise<void> {
  if (!isDailyEntryCountReconciliationPayload(issue.payload)) return;
  const ts = now();
  await db.syncIssues.update(issue.id, {
    status: "deferred",
    updated_at: ts,
    payload: {
      ...issue.payload,
      resolution: { choice: "defer", resolved_at: ts },
    },
  });
}

export function snapshotDailyEntryCounts(
  entry: DailyEntry | null | undefined
): Record<string, number> {
  return normalizeCounts(entry?.task_counts ?? null);
}
