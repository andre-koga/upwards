import { db, now, newId } from "@/lib/db";
import type { SyncPendingOperation, SyncPendingStatus } from "@/lib/db/types";
import { getCachedUserId } from "@/lib/supabase";
import { recordSyncIssue } from "./sync-issues-store";

export interface EnqueuePendingOperationInput {
  operation_id: string;
  account_id?: string | null;
  device_id: string;
  entity_type: string;
  entity_id?: string | null;
  operation_type: string;
  payload: unknown;
  base_revision?: string | null;
}

export async function enqueuePendingOperation(
  input: EnqueuePendingOperationInput
): Promise<SyncPendingOperation> {
  const ts = now();
  const row: SyncPendingOperation = {
    id: newId(),
    operation_id: input.operation_id,
    account_id: input.account_id ?? null,
    device_id: input.device_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    operation_type: input.operation_type,
    payload: input.payload,
    base_revision: input.base_revision ?? null,
    status: "pending",
    last_error: null,
    created_at: ts,
    updated_at: ts,
    acked_at: null,
  };
  await db.syncPendingOperations.add(row);
  return row;
}

export async function listPendingOperations(options?: {
  status?: SyncPendingStatus;
}): Promise<SyncPendingOperation[]> {
  if (options?.status) {
    const rows = await db.syncPendingOperations
      .where("status")
      .equals(options.status)
      .toArray();
    return rows.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const rows = await db.syncPendingOperations.toArray();
  return rows.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function countPendingOperations(options?: {
  status?: SyncPendingStatus;
}): Promise<number> {
  if (options?.status) {
    return db.syncPendingOperations
      .where("status")
      .equals(options.status)
      .count();
  }
  return db.syncPendingOperations.count();
}

export async function markOperationAcked(id: string): Promise<void> {
  const ts = now();
  await db.syncPendingOperations.update(id, {
    status: "acked",
    acked_at: ts,
    updated_at: ts,
    last_error: null,
  });
}

export async function markOperationFailed(
  id: string,
  error: string
): Promise<void> {
  await db.syncPendingOperations.update(id, {
    status: "failed",
    last_error: error,
    updated_at: now(),
  });
}

/** Keep the op in Waiting to sync, but surface the latest transport error. */
export async function markOperationRetryableError(
  id: string,
  error: string
): Promise<void> {
  await db.syncPendingOperations.update(id, {
    status: "pending",
    last_error: error,
    updated_at: now(),
  });
}

/** Move previously failed ops back to pending so the next sync retries them. */
export async function requeueFailedOperations(): Promise<number> {
  const failed = await listPendingOperations({ status: "failed" });
  if (failed.length === 0) return 0;
  const ts = now();
  await Promise.all(
    failed.map((row) =>
      db.syncPendingOperations.update(row.id, {
        status: "pending",
        updated_at: ts,
      })
    )
  );
  return failed.length;
}

/**
 * When temporal ops RPCs are unavailable, leave pending ops in place and surface
 * a sync error so merges are not silently dropped.
 */
export async function reportOpsUnavailablePending(): Promise<number> {
  const pending = await listPendingOperations({ status: "pending" });
  if (pending.length === 0) return 0;
  await recordSyncIssue({
    kind: "error",
    title: "Sync upgrade required",
    detail:
      "Habit counts and timeline merges need the sync operations service. Your pending changes stay on this device until it is available.",
    account_id: getCachedUserId(),
  });
  return pending.length;
}

/** @deprecated Use reportOpsUnavailablePending — kept for tests importing the old name. */
export async function acknowledgePendingWhenOpsUnavailable(): Promise<number> {
  return reportOpsUnavailablePending();
}

export async function discardPendingOperation(id: string): Promise<void> {
  await db.syncPendingOperations.update(id, {
    status: "discarded",
    updated_at: now(),
  });
}
