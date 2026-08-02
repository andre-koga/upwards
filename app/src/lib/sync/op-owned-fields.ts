/**
 * Columns owned by the semantic operation stream when temporal RPCs are live.
 * LWW row sync must not overwrite these or it can undo merges/conflicts.
 */
export const OP_OWNED_ACTIVITY_FIELDS = [
  "name",
  "routine",
  "completion_target",
  "group_id",
  "order_index",
] as const;

export const OP_OWNED_GROUP_FIELDS = ["name", "color", "order_index"] as const;

export const OP_OWNED_DAILY_ENTRY_FIELDS = [
  "task_counts",
  "paused_task_ids",
  "is_break_day",
] as const;

/** Dexie tables that are temporal/sync metadata (cleared on sign-out with SYNC_TABLES). */
export const TEMPORAL_LOCAL_TABLES = [
  "activityDefinitionVersions",
  "groupDefinitionVersions",
  "syncPendingOperations",
  "syncIssues",
  "syncDevices",
] as const;

export function stripOpOwnedFields<T extends Record<string, unknown>>(
  table: string,
  row: T
): T {
  const next = { ...row };
  if (table === "activities") {
    for (const key of OP_OWNED_ACTIVITY_FIELDS) delete next[key];
  } else if (table === "activity_groups") {
    for (const key of OP_OWNED_GROUP_FIELDS) delete next[key];
  } else if (table === "daily_entries") {
    for (const key of OP_OWNED_DAILY_ENTRY_FIELDS) delete next[key];
  }
  return next;
}

export function isOpOwnedProjectionTable(table: string): boolean {
  return (
    table === "activities" ||
    table === "activity_groups" ||
    table === "daily_entries"
  );
}
