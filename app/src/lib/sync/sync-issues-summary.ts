import { countPendingOperations } from "./pending-operations";
import { listSyncIssues } from "./sync-issues-store";

export interface SyncIssuesSummary {
  conflicts: number;
  pending: number;
  errors: number;
  openTotal: number;
}

export async function getSyncIssuesSummary(): Promise<SyncIssuesSummary> {
  const [openIssues, deferredConflicts] = await Promise.all([
    listSyncIssues({ status: "open" }),
    listSyncIssues({ kind: "conflict", status: "deferred" }),
  ]);
  const conflicts =
    openIssues.filter((issue) => issue.kind === "conflict").length +
    deferredConflicts.length;
  const errors = openIssues.filter((issue) => issue.kind === "error").length;
  const pendingIssueCount = openIssues.filter(
    (issue) => issue.kind === "pending"
  ).length;
  const pendingOps = await countPendingOperations({ status: "pending" });
  const pending = pendingIssueCount + pendingOps;
  const openTotal = conflicts + pending + errors;

  return { conflicts, pending, errors, openTotal };
}
