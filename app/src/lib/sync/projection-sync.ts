import { db } from "@/lib/db";
import type { SyncTable } from "@/lib/sync/sync-transformers";
import { normalizeSyncRow } from "@/lib/sync/sync-transformers";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import { enqueuePendingOperation } from "@/lib/sync/pending-operations";
import { getCachedUserId } from "@/lib/supabase";
import { newId } from "@/lib/db";
import { stripOpOwnedFields } from "@/lib/sync/op-owned-fields";
import type { RemoteSyncOperation } from "./sync-operations";
import { listOpenConflictEntityIds, recordSyncIssue } from "./sync-issues-store";
import { hasPendingOperationForEntity } from "./unsynced-data";
import { buildProjectionConflictPayloadFromOp } from "./projection-conflict-resolution";
import { maybeRecordTimelineOverlapInfo } from "./timeline-overlap";
import { reconcileJournalDuplicatesForDate } from "@/lib/journal/dedupe-by-date";

/** Tables whose rows sync exclusively via the operation stream when RPCs are live. */
export const OPS_MANAGED_SYNC_TABLES: SyncTable[] = [
  "journal_entries",
  "activity_periods",
  "one_time_tasks",
  "recurring_memos",
  "activity_streaks",
  "activity_status_events",
  "group_status_events",
  "activities",
  "activity_groups",
];

const SYNC_TABLE_TO_ENTITY_TYPE: Partial<Record<SyncTable, string>> = {
  journal_entries: "journal_entry",
  activity_periods: "activity_period",
  one_time_tasks: "one_time_task",
  recurring_memos: "recurring_memo",
  activity_streaks: "activity_streak",
  activity_status_events: "activity_status_event",
  group_status_events: "group_status_event",
  activities: "activity",
  activity_groups: "activity_group",
};

const ENTITY_TYPE_TO_SYNC_TABLE: Record<string, SyncTable> = {
  journal_entry: "journal_entries",
  activity_period: "activity_periods",
  one_time_task: "one_time_tasks",
  recurring_memo: "recurring_memos",
  activity_streak: "activity_streaks",
  activity_status_event: "activity_status_events",
  group_status_event: "group_status_events",
  activity: "activities",
  activity_group: "activity_groups",
};

const ENTITY_TYPE_TO_DEXIE_TABLE: Record<string, keyof typeof db> = {
  journal_entry: "journalEntries",
  activity_period: "activityPeriods",
  one_time_task: "oneTimeTasks",
  recurring_memo: "recurringMemos",
  activity_streak: "activityStreaks",
  activity_status_event: "activityStatusEvents",
  group_status_event: "groupStatusEvents",
  activity: "activities",
  activity_group: "activityGroups",
};

/** Status/lifecycle events are append-only — no base_revision conflicts. */
const APPEND_ONLY_ENTITY_TYPES = new Set([
  "activity_status_event",
  "group_status_event",
]);

let suppressProjectionEnqueue = 0;

export function withSuppressedProjectionEnqueue<T>(
  operation: () => Promise<T>
): Promise<T> {
  suppressProjectionEnqueue += 1;
  return operation().finally(() => {
    suppressProjectionEnqueue -= 1;
  });
}

export function isProjectionEnqueueSuppressed(): boolean {
  return suppressProjectionEnqueue > 0;
}

export function syncTableToEntityType(table: SyncTable): string | null {
  return SYNC_TABLE_TO_ENTITY_TYPE[table] ?? null;
}

export function entityTypeToSyncTable(entityType: string): SyncTable | null {
  return ENTITY_TYPE_TO_SYNC_TABLE[entityType] ?? null;
}

export function dexieTableForSyncTable(
  table: SyncTable
): keyof typeof db | null {
  const entityType = syncTableToEntityType(table);
  if (!entityType) return null;
  return ENTITY_TYPE_TO_DEXIE_TABLE[entityType] ?? null;
}

function rowForProjectionPayload(
  table: SyncTable,
  row: Record<string, unknown>
): Record<string, unknown> {
  const copy = { ...row };
  delete copy.synced_at;
  if (table === "daily_entries") {
    return stripOpOwnedFields(table, copy);
  }
  return copy;
}

function hasMeaningfulProjectionPayload(
  table: SyncTable,
  row: Record<string, unknown>
): boolean {
  const payload = rowForProjectionPayload(table, row);
  const keys = Object.keys(payload).filter((k) => k !== "id");
  return keys.length > 0;
}

export async function enqueueProjectionUpsertForTable(
  table: SyncTable,
  row: Record<string, unknown>,
  baseRevision?: string | null
): Promise<void> {
  if (isProjectionEnqueueSuppressed()) return;
  if (!getCachedUserId()) return;

  const entityType = syncTableToEntityType(table);
  if (!entityType) return;

  const id = typeof row.id === "string" ? row.id : null;
  if (!id) return;

  if (!hasMeaningfulProjectionPayload(table, row)) return;

  const payloadRow = rowForProjectionPayload(table, row);

  await enqueuePendingOperation({
    operation_id: newId(),
    account_id: getCachedUserId(),
    device_id: getOrCreateDeviceId(),
    entity_type: entityType,
    entity_id: id,
    operation_type: "projection.upsert",
    payload: { row: payloadRow },
    base_revision: APPEND_ONLY_ENTITY_TYPES.has(entityType)
      ? null
      : (baseRevision ?? null),
  });
}

export async function applyAcceptedProjectionOp(
  op: RemoteSyncOperation
): Promise<boolean> {
  const table = entityTypeToSyncTable(op.entity_type);
  const dexieKey = ENTITY_TYPE_TO_DEXIE_TABLE[op.entity_type];
  if (!table || !dexieKey) return false;

  const entityId = op.entity_id;
  if (!entityId) return false;

  const openConflicts = await listOpenConflictEntityIds();
  if (openConflicts.has(entityId)) {
    return false;
  }

  if (await hasPendingOperationForEntity(entityId)) {
    try {
      const payload = await buildProjectionConflictPayloadFromOp(op);
      await recordSyncIssue({
        kind: "conflict",
        title: "Unsent local edits",
        detail:
          "Another device changed this item while you still have unsent edits on this device.",
        entity_type: op.entity_type,
        entity_id: entityId,
        operation_id: op.operation_id,
        payload,
        account_id: getCachedUserId(),
      });
    } catch (err) {
      console.warn("[sync] failed to record pending-entity conflict", err);
    }
    return false;
  }

  const payload = op.payload ?? {};
  const row = payload.row;
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;

  const normalized: Record<string, unknown> & { synced_at: string | null } = {
    ...normalizeSyncRow(table, row as Record<string, unknown>),
    synced_at: (row as { updated_at?: string }).updated_at ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db[dexieKey] as any).put(normalized);

  if (op.entity_type === "journal_entry") {
    const entryDate = normalized.entry_date;
    if (typeof entryDate === "string") {
      await reconcileJournalDuplicatesForDate(entryDate, {
        preferredId: entityId,
      });
    }
  }

  if (
    op.entity_type === "activity_period" &&
    typeof normalized.daily_entry_id === "string" &&
    typeof normalized.activity_id === "string"
  ) {
    void maybeRecordTimelineOverlapInfo(
      normalized.daily_entry_id,
      normalized.activity_id
    );
  }

  return true;
}

export function isProjectionUpsertEntityType(entityType: string): boolean {
  return entityType in ENTITY_TYPE_TO_SYNC_TABLE;
}
