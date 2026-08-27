import { db, now } from "@/lib/db";
import type { SyncIssue } from "@/lib/db/types";
import {
  analyzeDefinitionFieldDiffs,
  combineDefinitionFields,
  formatConflictFieldValue,
  type ConflictResolutionChoice,
} from "@/lib/sync/field-diff";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import {
  enqueueProjectionUpsertForTable,
  entityTypeToSyncTable,
  dexieTableForSyncTable,
  withSuppressedProjectionEnqueue,
} from "@/lib/sync/projection-sync";
import { deferSyncIssue } from "@/lib/sync/sync-issues-store";
import { normalizeSyncRow } from "@/lib/sync/sync-transformers";
import { getCachedUserId, supabase } from "@/lib/supabase";
import type { RemoteSyncOperation } from "./sync-operations";

const PROJECTION_FIELD_KEYS: Record<string, readonly string[]> = {
  activity_period: [
    "activity_id",
    "daily_entry_id",
    "start_time",
    "end_time",
    "note",
    "deleted_at",
  ],
  one_time_task: [
    "title",
    "date",
    "due_date",
    "is_completed",
    "is_pinned",
    "is_archived",
    "order_index",
    "deleted_at",
  ],
  recurring_memo: [
    "title",
    "routine",
    "is_pinned",
    "is_enabled",
    "deleted_at",
  ],
  activity: [
    "name",
    "routine",
    "completion_target",
    "group_id",
    "order_index",
    "completed_at",
    "is_archived",
    "deleted_at",
  ],
  activity_group: ["name", "color", "order_index", "deleted_at"],
  activity_streak: ["activity_id", "date", "streak", "deleted_at"],
};

export interface ProjectionConflictSnapshot {
  device_id: string | null;
  updated_at: string | null;
  base_revision: string | null;
  fields: Record<string, unknown>;
}

export interface ProjectionConflictPayload {
  kind: "projection_conflict";
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  local: ProjectionConflictSnapshot;
  remote: ProjectionConflictSnapshot | null;
  base: ProjectionConflictSnapshot | null;
  differing_fields: string[];
  auto_combinable_fields: string[];
  both_changed_fields: string[];
  resolution?: {
    choice: ConflictResolutionChoice | "defer";
    resolved_at: string;
    resulting_updated_at?: string | null;
  };
}

export function isProjectionConflictPayload(
  value: unknown
): value is ProjectionConflictPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as ProjectionConflictPayload).kind === "projection_conflict"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function fieldsFromRow(
  entityType: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  const keys = PROJECTION_FIELD_KEYS[entityType] ?? Object.keys(row);
  const fields: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in row) fields[key] = row[key];
  }
  return fields;
}

function snapshotFromRow(
  entityType: string,
  row: Record<string, unknown>,
  deviceId: string | null,
  baseRevision?: string | null
): ProjectionConflictSnapshot {
  return {
    device_id: deviceId,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    base_revision: baseRevision ?? null,
    fields: fieldsFromRow(entityType, row),
  };
}

function entityLabel(entityType: string, fields: Record<string, unknown>): string {
  if (typeof fields.title === "string" && fields.title.trim()) {
    return fields.title.trim();
  }
  if (typeof fields.name === "string" && fields.name.trim()) {
    return fields.name.trim();
  }
  if (entityType === "activity_period") return "Timeline session";
  if (entityType === "one_time_task") return "Memo";
  if (entityType === "recurring_memo") return "Recurring memo";
  if (entityType === "activity_streak") return "Streak";
  return entityType.replace(/_/g, " ");
}

async function fetchRemoteProjectionRow(
  entityType: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const table = entityTypeToSyncTable(entityType);
  const userId = getCachedUserId();
  if (!table || !supabase || !userId) return null;

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", entityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeSyncRow(table, data as Record<string, unknown>);
}

async function loadLocalProjectionRow(
  entityType: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const table = entityTypeToSyncTable(entityType);
  if (!table) return null;
  const dexieKey = dexieTableForSyncTable(table);
  if (!dexieKey) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (db as any)[dexieKey].get(entityId);
  return row ? (row as Record<string, unknown>) : null;
}

export async function buildProjectionConflictPayload(params: {
  entity_type: string;
  entity_id: string;
  localRow?: Record<string, unknown> | null;
  remoteRow?: Record<string, unknown> | null;
  localDeviceId?: string | null;
  remoteDeviceId?: string | null;
  baseRevision?: string | null;
}): Promise<ProjectionConflictPayload> {
  const localRow =
    params.localRow ??
    (await loadLocalProjectionRow(params.entity_type, params.entity_id));
  if (!localRow) {
    throw new Error("Local row not found for projection conflict");
  }

  const remoteRow =
    params.remoteRow ??
    (await fetchRemoteProjectionRow(params.entity_type, params.entity_id));

  const local = snapshotFromRow(
    params.entity_type,
    localRow,
    params.localDeviceId ?? getOrCreateDeviceId(),
    params.baseRevision ?? null
  );
  const remote = remoteRow
    ? snapshotFromRow(
        params.entity_type,
        remoteRow,
        params.remoteDeviceId ?? null,
        params.baseRevision ?? null
      )
    : null;

  const diff = analyzeDefinitionFieldDiffs(
    local.fields,
    remote?.fields ?? null,
    null
  );

  return {
    kind: "projection_conflict",
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    entity_label: entityLabel(params.entity_type, local.fields),
    local,
    remote,
    base: null,
    ...diff,
  };
}

export async function buildProjectionConflictPayloadFromOp(
  op: RemoteSyncOperation,
  localRow?: Record<string, unknown> | null
): Promise<ProjectionConflictPayload> {
  const remoteRow = asRecord(asRecord(op.payload).row);
  return buildProjectionConflictPayload({
    entity_type: op.entity_type,
    entity_id: op.entity_id ?? "",
    localRow,
    remoteRow,
    remoteDeviceId: op.device_id,
    baseRevision: op.base_revision,
  });
}

export async function refreshProjectionConflictPayload(
  payload: ProjectionConflictPayload
): Promise<ProjectionConflictPayload> {
  return buildProjectionConflictPayload({
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    localDeviceId: payload.local.device_id,
    remoteDeviceId: payload.remote?.device_id ?? null,
    baseRevision: payload.local.base_revision,
  });
}

async function applyResolvedProjectionFields(
  entityType: string,
  entityId: string,
  fields: Record<string, unknown>,
  remoteUpdatedAt: string | null
): Promise<string> {
  const table = entityTypeToSyncTable(entityType);
  if (!table) throw new Error(`Unknown projection entity type: ${entityType}`);

  const dexieKey = dexieTableForSyncTable(table);
  if (!dexieKey) throw new Error(`Missing Dexie table for ${entityType}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (db as any)[dexieKey].get(entityId);
  if (!existing) {
    throw new Error("Local row not found for projection conflict resolution");
  }

  const ts = now();
  const next = {
    ...existing,
    ...fields,
    id: entityId,
    updated_at: ts,
  };

  await withSuppressedProjectionEnqueue(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)[dexieKey].put(next);
    await enqueueProjectionUpsertForTable(
      table,
      next as Record<string, unknown>,
      remoteUpdatedAt ?? existing.updated_at
    );
  });

  return next.updated_at;
}

async function markProjectionIssueResolved(
  issue: SyncIssue,
  payload: ProjectionConflictPayload,
  choice: ConflictResolutionChoice | "defer",
  resultingUpdatedAt: string | null
): Promise<void> {
  const ts = now();
  const nextPayload: ProjectionConflictPayload = {
    ...payload,
    resolution: {
      choice,
      resolved_at: ts,
      resulting_updated_at: resultingUpdatedAt,
    },
  };

  await db.syncIssues.update(issue.id, {
    status: choice === "defer" ? "deferred" : "resolved",
    resolved_at: choice === "defer" ? null : ts,
    updated_at: ts,
    payload: nextPayload,
  });
}

export async function resolveProjectionConflict(
  issue: SyncIssue,
  choice: ConflictResolutionChoice
): Promise<void> {
  if (!isProjectionConflictPayload(issue.payload)) {
    throw new Error("Conflict issue is missing a projection conflict payload");
  }

  const payload = await refreshProjectionConflictPayload(issue.payload);
  const remoteFields = payload.remote?.fields ?? null;
  let chosenFields: Record<string, unknown>;

  if (choice === "keep_local") {
    chosenFields = payload.local.fields;
  } else if (choice === "keep_remote") {
    if (!remoteFields) {
      throw new Error("Remote version is unavailable for this conflict");
    }
    chosenFields = remoteFields;
  } else if (!remoteFields) {
    throw new Error("Remote version is unavailable to combine");
  } else {
    chosenFields = combineDefinitionFields(
      payload.local.fields,
      remoteFields,
      null,
      { preferLocalOnConflict: true }
    );
  }

  const resultingUpdatedAt = await applyResolvedProjectionFields(
    payload.entity_type,
    payload.entity_id,
    chosenFields,
    payload.remote?.updated_at ?? null
  );

  await markProjectionIssueResolved(issue, payload, choice, resultingUpdatedAt);
}

export async function deferProjectionConflict(issue: SyncIssue): Promise<void> {
  if (!isProjectionConflictPayload(issue.payload)) {
    await deferSyncIssue(issue.id);
    return;
  }
  const payload = await refreshProjectionConflictPayload(issue.payload);
  await markProjectionIssueResolved(issue, payload, "defer", null);
}

export async function resolveGenericProjectionConflictKeepLocal(
  issue: SyncIssue
): Promise<void> {
  if (isProjectionConflictPayload(issue.payload)) {
    await resolveProjectionConflict(issue, "keep_local");
    return;
  }

  const entityType = issue.entity_type;
  const entityId = issue.entity_id;
  if (!entityType || !entityId) {
    throw new Error("Conflict issue is missing entity metadata");
  }

  const payload = await buildProjectionConflictPayload({
    entity_type: entityType,
    entity_id: entityId,
  });
  await resolveProjectionConflict(
    { ...issue, payload },
    "keep_local"
  );
}

export function formatProjectionConflictFieldValue(
  field: string,
  value: unknown
): string {
  return formatConflictFieldValue(value);
}
