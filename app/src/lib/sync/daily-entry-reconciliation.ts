import { db, now } from "@/lib/db";
import type { SyncIssue } from "@/lib/db/types";

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
