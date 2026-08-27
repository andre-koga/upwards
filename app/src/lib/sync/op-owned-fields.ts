/**
 * Columns owned by the semantic operation stream when temporal RPCs are live.
 * LWW row sync must not overwrite these or it can undo merges/conflicts.
 *
 * Activity and group definition fields are current-state rows and sync with
 * the rest of the projection. Daily counts/pauses/break days stay op-owned.
 */
export const OP_OWNED_DAILY_ENTRY_FIELDS = [
  "task_counts",
  "paused_task_ids",
  "is_break_day",
] as const;

/** Dexie tables that are temporal/sync metadata (cleared on sign-out with SYNC_TABLES). */
export const TEMPORAL_LOCAL_TABLES = [
  "syncPendingOperations",
  "syncIssues",
  "syncDevices",
] as const;

export function stripOpOwnedFields<T extends Record<string, unknown>>(
  table: string,
  row: T
): T {
  const next = { ...row };
  if (table === "daily_entries") {
    for (const key of OP_OWNED_DAILY_ENTRY_FIELDS) delete next[key];
  }
  return next;
}

export function isOpOwnedProjectionTable(table: string): boolean {
  return table === "daily_entries";
}
