const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SyncTable =
  | "activity_groups"
  | "activities"
  | "daily_entries"
  | "activity_periods"
  | "journal_entries"
  | "one_time_tasks"
  | "activity_streaks"
  | "memo_periods";

export const UPSERT_CONFLICT_TARGET: Record<SyncTable, string> = {
  activity_groups: "id",
  activities: "id",
  daily_entries: "user_id,date",
  activity_periods: "id",
  journal_entries: "user_id,entry_date",
  one_time_tasks: "id",
  activity_streaks: "user_id,activity_id,date",
  memo_periods: "id",
};

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function sanitizeUuidReferences(
  table: SyncTable,
  row: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...row };

  if (table === "activities" && !isValidUuid(sanitized.group_id)) {
    sanitized.group_id = null;
  }

  if (
    table === "daily_entries" &&
    !isValidUuid(sanitized.current_activity_id)
  ) {
    sanitized.current_activity_id = null;
  }

  if (table === "daily_entries" && !isValidUuid(sanitized.current_memo_id)) {
    sanitized.current_memo_id = null;
  }

  if (table === "activity_periods") {
    if (!isValidUuid(sanitized.daily_entry_id)) {
      sanitized.daily_entry_id = null;
    }
    if (!isValidUuid(sanitized.activity_id)) {
      sanitized.activity_id = null;
    }
  }

  if (table === "activity_streaks" && !isValidUuid(sanitized.activity_id)) {
    sanitized.activity_id = null;
  }

  if (table === "memo_periods") {
    if (!isValidUuid(sanitized.daily_entry_id)) {
      sanitized.daily_entry_id = null;
    }
    if (!isValidUuid(sanitized.one_time_task_id)) {
      sanitized.one_time_task_id = null;
    }
  }

  return sanitized;
}

export function toRemoteRow<T extends Record<string, unknown>>(
  table: SyncTable,
  record: T,
  userId: string
): (Omit<T, "synced_at"> & { user_id: string }) | null {
  const remoteRecord = {
    ...(record as T & { synced_at?: unknown }),
  } as Record<string, unknown>;

  if (!isValidUuid(remoteRecord.id)) {
    return null;
  }

  delete remoteRecord.synced_at;
  return {
    ...sanitizeUuidReferences(table, remoteRecord),
    user_id: userId,
  } as Omit<T, "synced_at"> & { user_id: string };
}

export function parseTimestamp(value: unknown): number {
  if (typeof value !== "string") return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

export function dedupeRowsForUpsert<T extends Record<string, unknown>>(
  table: SyncTable,
  rows: T[]
): T[] {
  const conflictCols = UPSERT_CONFLICT_TARGET[table]
    .split(",")
    .map((s) => s.trim());

  const byConflictKey = new Map<string, T>();

  for (const row of rows) {
    const conflictKey = conflictCols
      .map((col) => String(row[col] ?? ""))
      .join("|");

    const existing = byConflictKey.get(conflictKey);
    if (!existing) {
      byConflictKey.set(conflictKey, row);
      continue;
    }

    const existingTs = parseTimestamp(existing.updated_at);
    const incomingTs = parseTimestamp(row.updated_at);
    if (incomingTs >= existingTs) {
      byConflictKey.set(conflictKey, row);
    }
  }

  return Array.from(byConflictKey.values());
}
