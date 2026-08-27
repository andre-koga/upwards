import { db, now, newId } from "@/lib/db";
import type {
  ActivityDefinitionVersion,
  GroupDefinitionVersion,
} from "@/lib/db/types";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { DEFINITION_SCHEMA_VERSION } from "@/lib/activity/definition-versions";
import { getOrCreateDeviceId } from "./device-id";
import {
  collapseDuplicatePendingProjectionUpserts,
  listPendingOperations,
  markOperationAcked,
  markOperationFailed,
  markOperationRetryableError,
  requeueFailedOperations,
} from "./pending-operations";
import { SUBMIT_SYNC_BATCH_SIZE } from "./sync-constants";
import { recordSyncIssue } from "./sync-issues-store";
import { isTransientNetworkError } from "@/lib/error-utils";
import {
  buildDefinitionConflictPayload,
  type DefinitionConflictEntityType,
} from "./conflict-resolution";
import { buildJournalConflictPayload } from "./journal-conflict-resolution";
import { buildProjectionConflictPayload } from "./projection-conflict-resolution";
import { saveOpsRpcAvailable, loadOpsRpcAvailable } from "./sync-storage";
import {
  applyAcceptedProjectionOp,
  isProjectionUpsertEntityType,
  withSuppressedProjectionEnqueue,
} from "./projection-sync";
import { getOrCreateDailyEntry } from "@/lib/db/daily-entry";
import { reconcileAllJournalDuplicates } from "@/lib/journal/dedupe-by-date";

export interface SubmitSyncOperationInput {
  operation_id: string;
  device_id: string;
  entity_type: string;
  entity_id: string | null;
  operation_type: string;
  payload: unknown;
  base_revision: string | null;
}

export interface SubmitSyncOperationResult {
  operation_id: string;
  status: "accepted" | "duplicate" | "conflict" | "error" | string;
  server_sequence: number;
  detail?: string;
}

export interface RemoteSyncOperation {
  operation_id: string;
  device_id: string;
  entity_type: string;
  entity_id: string | null;
  operation_type: string;
  payload: Record<string, unknown>;
  base_revision: string | null;
  status: string;
  server_sequence: number;
  created_at: string;
}

export interface PushPendingOperationsResult {
  failed: boolean;
  maxSequence?: number;
  skipped?: boolean;
  /** True when failure was abort/offline noise and ops stayed pending. */
  transient?: boolean;
  /**
   * True when the server resolved each op individually and rejected some.
   *
   * Distinguishes "the RPC died and we cannot tell which op is bad" (worth
   * re-submitting one at a time to isolate the culprit) from "the server already
   * told us exactly which ops it rejected" (re-submitting proves nothing and just
   * burns retry attempts).
   */
  perOpRejection?: boolean;
}

export interface PullAndApplyOperationsResult {
  maxSequence?: number;
  skipped?: boolean;
}

interface DefinitionPayload {
  version_id?: string;
  parent_version_id?: string | null;
  effective_from?: string;
  recorded_at?: string;
  schema_version?: number;
  fields?: Record<string, unknown>;
}

export function isSyncOperationsRpcMissing(
  error: {
    code?: string;
    message?: string;
    details?: string;
  } | null
): boolean {
  if (!error) return false;
  const haystack = [error.code, error.message, error.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    haystack.includes("submit_sync_operations") ||
    haystack.includes("pull_sync_operations") ||
    haystack.includes("pull_sync_snapshot") ||
    haystack.includes("could not find the function") ||
    (haystack.includes("function") && haystack.includes("does not exist")) ||
    error.code === "PGRST202" ||
    error.code === "42883"
  );
}

export function maxServerSequence(
  sequences: Array<number | null | undefined>
): number | undefined {
  let max: number | undefined;
  for (const seq of sequences) {
    if (seq == null || !Number.isFinite(seq)) continue;
    if (max == null || seq > max) max = seq;
  }
  return max;
}

export function toSubmitSyncOperationInput(pending: {
  operation_id: string;
  device_id: string;
  entity_type: string;
  entity_id: string | null;
  operation_type: string;
  payload: unknown;
  base_revision: string | null;
}): SubmitSyncOperationInput {
  return {
    operation_id: pending.operation_id,
    device_id: pending.device_id,
    entity_type: pending.entity_type,
    entity_id: pending.entity_id,
    operation_type: pending.operation_type,
    payload: pending.payload,
    base_revision: pending.base_revision,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function buildActivityDefinitionVersionFromOp(
  op: RemoteSyncOperation
): ActivityDefinitionVersion | null {
  if (!op.entity_id) return null;
  const payload = (op.payload ?? {}) as DefinitionPayload;
  const fields = payload.fields ?? {};
  const versionId = asString(payload.version_id);
  if (!versionId) return null;

  return {
    id: versionId,
    activity_id: op.entity_id,
    parent_version_id: asString(payload.parent_version_id),
    effective_from: asString(payload.effective_from) ?? getEffectiveToday(),
    recorded_at:
      asString(payload.recorded_at) ?? asString(op.created_at) ?? now(),
    server_sequence: op.server_sequence,
    operation_id: op.operation_id,
    device_id: op.device_id,
    name: asString(fields.name),
    routine: asString(fields.routine),
    completion_target: asNumber(fields.completion_target),
    group_id: asString(fields.group_id) ?? "",
    order_index: asNumber(fields.order_index),
    schema_version:
      asNumber(payload.schema_version) ?? DEFINITION_SCHEMA_VERSION,
    created_at: asString(op.created_at) ?? now(),
    deleted_at: null,
  };
}

export function buildGroupDefinitionVersionFromOp(
  op: RemoteSyncOperation
): GroupDefinitionVersion | null {
  if (!op.entity_id) return null;
  const payload = (op.payload ?? {}) as DefinitionPayload;
  const fields = payload.fields ?? {};
  const versionId = asString(payload.version_id);
  if (!versionId) return null;

  return {
    id: versionId,
    group_id: op.entity_id,
    parent_version_id: asString(payload.parent_version_id),
    effective_from: asString(payload.effective_from) ?? getEffectiveToday(),
    recorded_at:
      asString(payload.recorded_at) ?? asString(op.created_at) ?? now(),
    server_sequence: op.server_sequence,
    operation_id: op.operation_id,
    device_id: op.device_id,
    name: asString(fields.name) ?? "Group",
    color: asString(fields.color),
    order_index: asNumber(fields.order_index),
    schema_version:
      asNumber(payload.schema_version) ?? DEFINITION_SCHEMA_VERSION,
    created_at: asString(op.created_at) ?? now(),
    deleted_at: null,
  };
}

export function activityProjectionPatchFromPayload(
  payload: DefinitionPayload
): Partial<{
  name: string | null;
  routine: string | null;
  completion_target: number | null;
  group_id: string;
  order_index: number | null;
}> {
  const fields = payload.fields ?? {};
  const patch: Partial<{
    name: string | null;
    routine: string | null;
    completion_target: number | null;
    group_id: string;
    order_index: number | null;
  }> = {};

  if (fields.name !== undefined) patch.name = asString(fields.name);
  if (fields.routine !== undefined) patch.routine = asString(fields.routine);
  if (fields.completion_target !== undefined) {
    patch.completion_target = asNumber(fields.completion_target);
  }
  if (fields.group_id !== undefined) {
    patch.group_id = asString(fields.group_id) ?? "";
  }
  if (fields.order_index !== undefined) {
    patch.order_index = asNumber(fields.order_index);
  }

  return patch;
}

export function groupProjectionPatchFromPayload(
  payload: DefinitionPayload
): Partial<{
  name: string;
  color: string | null;
  order_index: number | null;
}> {
  const fields = payload.fields ?? {};
  const patch: Partial<{
    name: string;
    color: string | null;
    order_index: number | null;
  }> = {};

  if (fields.name !== undefined) {
    patch.name = asString(fields.name) ?? "Group";
  }
  if (fields.color !== undefined) patch.color = asString(fields.color);
  if (fields.order_index !== undefined) {
    patch.order_index = asNumber(fields.order_index);
  }

  return patch;
}

async function ensureConflictIssueForRemoteOp(
  op: RemoteSyncOperation
): Promise<void> {
  const existing = await db.syncIssues
    .filter(
      (issue) =>
        issue.operation_id === op.operation_id &&
        issue.kind === "conflict" &&
        issue.status === "open"
    )
    .first();

  if (existing) return;

  const entityId = op.entity_id;
  let payload: unknown = op.payload;
  let title = "Sync conflict";
  let detail = "Your change conflicted with a newer version on another device.";

  if (
    entityId &&
    (op.entity_type === "activity_definition" ||
      op.entity_type === "group_definition")
  ) {
    const entityType =
      op.entity_type === "group_definition"
        ? "group_definition"
        : "activity_definition";
    title = "Definition update conflict";
    detail = `A change to this ${entityType === "group_definition" ? "group" : "activity"} conflicted with another version.`;
    try {
      // Remote conflicted op is "theirs"; local tip is "yours".
      payload = await buildDefinitionConflictPayload({
        entity_type: entityType as DefinitionConflictEntityType,
        entity_id: entityId,
        remotePayload: op.payload,
        remoteDeviceId: op.device_id,
      });
    } catch (err) {
      console.warn("[sync] failed to enrich remote conflict payload", err);
    }
  } else if (entityId && op.entity_type === "journal_entry") {
    title = "Journal entry conflict";
    detail =
      "This journal entry was edited on another device. Choose which version to keep.";
    try {
      const opRow = asRecord(asRecord(op.payload).row) as Record<
        string,
        unknown
      >;
      payload = await buildJournalConflictPayload({
        entity_id: entityId,
        remoteRow: opRow,
        remoteDeviceId: op.device_id,
      });
    } catch (err) {
      console.warn("[sync] failed to enrich journal conflict payload", err);
    }
  } else if (entityId && isProjectionUpsertEntityType(op.entity_type)) {
    title = "Item conflict";
    detail =
      "This item was edited on another device. Choose which version to keep.";
    try {
      const opRow = asRecord(asRecord(op.payload).row) as Record<
        string,
        unknown
      >;
      payload = await buildProjectionConflictPayload({
        entity_type: op.entity_type,
        entity_id: entityId,
        remoteRow: opRow,
        remoteDeviceId: op.device_id,
        baseRevision: op.base_revision,
      });
    } catch (err) {
      console.warn("[sync] failed to enrich remote projection conflict", err);
    }
  }

  await recordSyncIssue({
    kind: "conflict",
    title,
    detail,
    entity_type: op.entity_type,
    entity_id: op.entity_id,
    operation_id: op.operation_id,
    payload,
    account_id: getCachedUserId(),
  });
}

async function applyAcceptedDefinitionOp(
  op: RemoteSyncOperation
): Promise<void> {
  const payload = (op.payload ?? {}) as DefinitionPayload;
  const ts = now();

  if (
    op.entity_type === "activity_definition" &&
    (op.operation_type === "definition.create" ||
      op.operation_type === "definition.update")
  ) {
    if (!op.entity_id) return;
    const patch = activityProjectionPatchFromPayload(payload);
    if (Object.keys(patch).length > 0) {
      await db.activities.update(op.entity_id, {
        ...patch,
        updated_at: ts,
      });
    }
    return;
  }

  if (
    op.entity_type === "group_definition" &&
    (op.operation_type === "definition.create" ||
      op.operation_type === "definition.update")
  ) {
    if (!op.entity_id) return;
    const patch = groupProjectionPatchFromPayload(payload);
    if (Object.keys(patch).length > 0) {
      await db.activityGroups.update(op.entity_id, {
        ...patch,
        updated_at: ts,
      });
    }
  }
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Apply a remote daily_entry semantic op to the local projection (mirrors server RPC). */
export async function applyAcceptedDailyEntryOp(
  op: RemoteSyncOperation
): Promise<void> {
  if (op.entity_type !== "daily_entry") return;

  const payload = op.payload ?? {};
  const date = asString(payload.date);
  if (!date) return;

  const activityId = asString(payload.activity_id) ?? asString(op.entity_id);
  const ts = now();

  let entry = await getOrCreateDailyEntry(date);

  const counts: Record<string, number> = {
    ...((entry.task_counts as Record<string, number> | null) ?? {}),
  };
  const paused = new Set(entry.paused_task_ids ?? []);

  if (op.operation_type === "count.delta" && activityId) {
    const delta = asNumber(payload.delta) ?? 0;
    const prev = counts[activityId] ?? 0;
    const next = Math.max(0, prev + delta);
    if (next === 0) delete counts[activityId];
    else counts[activityId] = next;
    await db.dailyEntries.update(entry.id, {
      task_counts: counts,
      updated_at: ts,
    });
    return;
  }

  if (op.operation_type === "pause.enable" && activityId) {
    paused.add(activityId);
    await db.dailyEntries.update(entry.id, {
      paused_task_ids: [...paused],
      updated_at: ts,
    });
    return;
  }

  if (op.operation_type === "pause.disable" && activityId) {
    paused.delete(activityId);
    await db.dailyEntries.update(entry.id, {
      paused_task_ids: [...paused],
      updated_at: ts,
    });
    return;
  }

  if (op.operation_type === "break_day.enable") {
    await db.dailyEntries.update(entry.id, {
      is_break_day: true,
      updated_at: ts,
    });
    return;
  }

  if (op.operation_type === "break_day.disable") {
    await db.dailyEntries.update(entry.id, {
      is_break_day: false,
      updated_at: ts,
    });
    return;
  }

  if (op.operation_type === "completion.note" && activityId) {
    const notes: Record<string, string> = {
      ...((entry.completion_notes as Record<string, string> | null) ?? {}),
    };
    const note = asString(payload.note);
    if (note) notes[activityId] = note;
    else delete notes[activityId];
    await db.dailyEntries.update(entry.id, {
      completion_notes: notes,
      updated_at: ts,
    });
    return;
  }
  const breakFlag = asBoolean(payload.is_break_day);
  if (breakFlag != null) {
    await db.dailyEntries.update(entry.id, {
      is_break_day: breakFlag,
      updated_at: ts,
    });
  }
}

async function submitPendingOperationBatch(
  pending: Awaited<ReturnType<typeof listPendingOperations>>
): Promise<PushPendingOperationsResult> {
  if (!supabase) return { failed: false, skipped: true };

  const ops = pending.map(toSubmitSyncOperationInput);
  const { data, error } = await supabase.rpc("submit_sync_operations", {
    ops,
  });

  if (error) {
    if (isSyncOperationsRpcMissing(error)) {
      saveOpsRpcAvailable(false);
      return { failed: false, skipped: true };
    }
    // Transient fetch/abort: keep Waiting items pending for the next retry.
    if (isTransientNetworkError(error)) {
      for (const row of pending) {
        await markOperationRetryableError(row.id, error.message);
      }
      return { failed: true, transient: true };
    }
    for (const row of pending) {
      await markOperationFailed(row.id, error.message);
    }
    return { failed: true };
  }

  saveOpsRpcAvailable(true);

  const results = (data ?? []) as SubmitSyncOperationResult[];
  const pendingByOperationId = new Map(
    pending.map((row) => [row.operation_id, row])
  );
  let settled = 0;
  let rejected = 0;

  for (const result of results) {
    const local = pendingByOperationId.get(result.operation_id);
    if (!local) continue;

    if (result.status === "accepted" || result.status === "duplicate") {
      await markOperationAcked(local.id);
      settled += 1;
      continue;
    }

    if (result.status === "error") {
      await markOperationFailed(
        local.id,
        result.detail && result.detail.length > 0
          ? result.detail
          : "Server rejected this change"
      );
      // Deliberately NOT counted as settled. A rejected op still holds user data
      // that never reached the server, so the push did not succeed. Counting it
      // here is what made the caller report a clean sync, clear the error cards,
      // and let the sign-out gate wipe the row.
      rejected += 1;
      continue;
    }

    if (result.status === "conflict") {
      let conflictPayload: unknown = local.payload;
      let title = "Sync conflict";
      let detail =
        "Your change conflicted with a newer version on another device.";

      if (
        local.entity_id &&
        (local.entity_type === "activity_definition" ||
          local.entity_type === "group_definition")
      ) {
        title = "Definition update conflict";
        detail =
          "Your change conflicted with a newer definition on another device.";
        try {
          conflictPayload = await buildDefinitionConflictPayload({
            entity_type: local.entity_type as DefinitionConflictEntityType,
            entity_id: local.entity_id,
            localPayload: local.payload,
            localDeviceId: local.device_id,
          });
        } catch (err) {
          console.warn("[sync] failed to enrich local conflict payload", err);
        }
      } else if (local.entity_type === "journal_entry" && local.entity_id) {
        title = "Journal entry conflict";
        detail =
          "This journal entry was edited on another device. Choose which version to keep.";
        try {
          const opRow = asRecord(asRecord(local.payload).row) as Record<
            string,
            unknown
          >;
          conflictPayload = await buildJournalConflictPayload({
            entity_id: local.entity_id,
            localRow: opRow,
            localDeviceId: local.device_id,
            baseRevision: local.base_revision,
          });
        } catch (err) {
          console.warn("[sync] failed to enrich journal conflict payload", err);
        }
      } else if (
        local.entity_id &&
        isProjectionUpsertEntityType(local.entity_type)
      ) {
        title = "Item conflict";
        detail =
          "This item was edited on another device. Choose which version to keep.";
        try {
          const opRow = asRecord(asRecord(local.payload).row) as Record<
            string,
            unknown
          >;
          conflictPayload = await buildProjectionConflictPayload({
            entity_type: local.entity_type,
            entity_id: local.entity_id,
            localRow: opRow,
            localDeviceId: local.device_id,
            baseRevision: local.base_revision,
          });
        } catch (err) {
          console.warn(
            "[sync] failed to enrich projection conflict payload",
            err
          );
        }
      }

      await recordSyncIssue({
        kind: "conflict",
        title,
        detail,
        entity_type: local.entity_type,
        entity_id: local.entity_id,
        operation_id: local.operation_id,
        payload: conflictPayload,
        account_id: getCachedUserId(),
      });
      await markOperationAcked(local.id);
      settled += 1;
      continue;
    }

    await markOperationFailed(
      local.id,
      `Unexpected sync status: ${result.status}`
    );
    settled += 1;
  }

  if (pending.length > 0 && settled === 0) {
    return { failed: true };
  }

  // A partially-rejected batch is still a failed push. The accepted ops are
  // acked and will not be resent, but the rejected ones hold data the server
  // does not have, so the caller must not treat this as a clean sync.
  if (rejected > 0) {
    return {
      failed: true,
      perOpRejection: true,
      maxSequence: maxServerSequence(results.map((r) => r.server_sequence)),
    };
  }

  return {
    failed: false,
    maxSequence: maxServerSequence(results.map((r) => r.server_sequence)),
  };
}

/** Parents before children so a cutover batch does not FK-fail periods first. */
const SUBMIT_ENTITY_PRIORITY: Record<string, number> = {
  activity_group: 0,
  activity: 1,
  recurring_memo: 2,
  journal_entry: 3,
  one_time_task: 4,
  activity_status_event: 5,
  group_status_event: 6,
  activity_period: 7,
};

export function comparePendingForSubmit(
  a: { entity_type: string; created_at: string },
  b: { entity_type: string; created_at: string }
): number {
  const ao = SUBMIT_ENTITY_PRIORITY[a.entity_type] ?? 40;
  const bo = SUBMIT_ENTITY_PRIORITY[b.entity_type] ?? 40;
  if (ao !== bo) return ao - bo;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export async function pushPendingOperations(): Promise<PushPendingOperationsResult> {
  if (!supabase) return { failed: false, skipped: true };

  await requeueFailedOperations();
  await collapseDuplicatePendingProjectionUpserts();

  let maxSequence: number | undefined;

  while (true) {
    const pending = await listPendingOperations({ status: "pending" });
    if (pending.length === 0) {
      return maxSequence == null
        ? { failed: false }
        : { failed: false, maxSequence };
    }

    const batch = pending
      .slice()
      .sort(comparePendingForSubmit)
      .slice(0, SUBMIT_SYNC_BATCH_SIZE);

    const result = await submitPendingOperationBatch(batch);
    if (result.skipped) return { failed: false, skipped: true };
    if (result.failed && result.transient) {
      return {
        failed: true,
        transient: true,
        ...(maxSequence != null ? { maxSequence } : {}),
      };
    }
    // The server already adjudicated each op. Splitting the batch would resubmit
    // ops it just rejected, and because the loop re-reads `pending` each pass,
    // continuing here would spin: the rejected ops are `failed`, not `pending`,
    // so return and let the next sync tick retry them under the attempt ceiling.
    if (result.failed && result.perOpRejection) {
      maxSequence = maxServerSequence([maxSequence, result.maxSequence]);
      return {
        failed: true,
        perOpRejection: true,
        ...(maxSequence != null ? { maxSequence } : {}),
      };
    }
    if (result.failed && batch.length > 1) {
      // Whole-RPC failure: the server told us nothing per-op, so isolate the bad
      // op by submitting one at a time.
      let anyAcked = false;
      let anyRejected = false;
      for (const row of batch) {
        const one = await submitPendingOperationBatch([row]);
        if (one.skipped) return { failed: false, skipped: true };
        if (one.failed && one.transient) {
          return {
            failed: true,
            transient: true,
            ...(maxSequence != null ? { maxSequence } : {}),
          };
        }
        maxSequence = maxServerSequence([maxSequence, one.maxSequence]);
        if (one.failed) {
          anyRejected = true;
          continue;
        }
        anyAcked = true;
      }
      if (!anyAcked || anyRejected) {
        // Either nothing got through, or some op is still stranded. Both are a
        // failed push; returning also avoids re-looping over `failed` rows.
        return {
          failed: true,
          ...(anyRejected ? { perOpRejection: true } : {}),
          ...(maxSequence != null ? { maxSequence } : {}),
        };
      }
      continue;
    }
    if (result.failed) {
      return {
        failed: true,
        ...(maxSequence != null ? { maxSequence } : {}),
      };
    }
    maxSequence = maxServerSequence([maxSequence, result.maxSequence]);
  }
}

export async function pullAndApplyOperations(
  sinceSequence: number
): Promise<PullAndApplyOperationsResult> {
  if (!supabase) return { skipped: true };

  const { data, error } = await supabase.rpc("pull_sync_operations", {
    since_sequence: sinceSequence,
  });

  if (error) {
    if (isSyncOperationsRpcMissing(error)) {
      saveOpsRpcAvailable(false);
      return { skipped: true };
    }
    throw new Error(`pull_sync_operations failed: ${error.message}`);
  }

  saveOpsRpcAvailable(true);

  const ops = (data ?? []) as RemoteSyncOperation[];
  if (ops.length === 0) {
    return { maxSequence: sinceSequence > 0 ? sinceSequence : undefined };
  }

  const localDeviceId = getOrCreateDeviceId();

  for (const op of ops) {
    if (op.status === "conflict" && op.device_id !== localDeviceId) {
      await ensureConflictIssueForRemoteOp(op);
      continue;
    }

    if (op.status !== "accepted") continue;
    if (op.device_id === localDeviceId) continue;

    if (
      op.entity_type === "activity_definition" ||
      op.entity_type === "group_definition"
    ) {
      await withSuppressedProjectionEnqueue(() =>
        applyAcceptedDefinitionOp(op)
      );
    } else if (op.entity_type === "daily_entry") {
      await withSuppressedProjectionEnqueue(() =>
        applyAcceptedDailyEntryOp(op)
      );
    } else if (
      isProjectionUpsertEntityType(op.entity_type) &&
      op.operation_type === "projection.upsert"
    ) {
      await withSuppressedProjectionEnqueue(() =>
        applyAcceptedProjectionOp(op)
      );
    }
  }

  await reconcileAllJournalDuplicates();

  return {
    maxSequence: maxServerSequence([
      sinceSequence,
      ...ops.map((op) => op.server_sequence),
    ]),
  };
}
