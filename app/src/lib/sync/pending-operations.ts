import { db, now, newId } from "@/lib/db";
import type { SyncPendingOperation, SyncPendingStatus } from "@/lib/db/types";

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

export async function discardPendingOperation(id: string): Promise<void> {
  await db.syncPendingOperations.update(id, {
    status: "discarded",
    updated_at: now(),
  });
}
