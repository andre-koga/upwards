import { db, now, newId } from "@/lib/db";
import type { SyncPendingOperation, SyncPendingStatus } from "@/lib/db/types";
import { getCachedUserId } from "@/lib/supabase";
import { recordSyncIssue } from "./sync-issues-store";

/**
 * Retry ceiling for a server-rejected op.
 *
 * `requeueFailedOperations` used to requeue unconditionally, so an op the server
 * rejects deterministically (a foreign key that will never exist, an oversized
 * field) looped `pending -> error -> failed -> pending` on every sync tick
 * forever. The op still holds user data, so it is never discarded — it just stops
 * being retried and stays visible as a sync issue for the user to act on.
 */
export const MAX_PUSH_ATTEMPTS = 5;

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

/**
 * Records a server rejection.
 *
 * This must stay loud. A rejected op holds user data that is not on the server,
 * and it used to be written here and then never surfaced anywhere: no error card,
 * no badge, and `pushPendingOperations` reported the batch as a success. The user
 * saw a green sync while a row sat stranded, and the next sign-out wiped it.
 */
export async function markOperationFailed(
  id: string,
  error: string
): Promise<void> {
  const existing = await db.syncPendingOperations.get(id);
  const attempts = (existing?.attempt_count ?? 0) + 1;

  await db.syncPendingOperations.update(id, {
    status: "failed",
    last_error: error,
    attempt_count: attempts,
    updated_at: now(),
  });

  await recordSyncIssue({
    kind: "error",
    title: "A change was rejected",
    detail:
      attempts >= MAX_PUSH_ATTEMPTS
        ? `The server rejected this change ${attempts} times and it is no longer being retried. It is still saved on this device. (${error})`
        : `The server rejected this change. It is still saved on this device and will be retried. (${error})`,
    entity_type: existing?.entity_type ?? null,
    entity_id: existing?.entity_id ?? null,
    operation_id: existing?.operation_id ?? null,
    account_id: existing?.account_id ?? getCachedUserId(),
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

/**
 * Moves failed ops back to pending so the next sync retries them.
 *
 * Ops past `MAX_PUSH_ATTEMPTS` are left alone: retrying them cannot succeed and
 * the loop hid a permanent failure behind an infinitely "busy" queue. They keep
 * their data and their sync issue.
 */
export async function requeueFailedOperations(): Promise<number> {
  const failed = await listPendingOperations({ status: "failed" });
  const retryable = failed.filter(
    (row) => (row.attempt_count ?? 0) < MAX_PUSH_ATTEMPTS
  );
  if (retryable.length === 0) return 0;
  const ts = now();
  await Promise.all(
    retryable.map((row) =>
      db.syncPendingOperations.update(row.id, {
        status: "pending",
        updated_at: ts,
      })
    )
  );
  return retryable.length;
}

/**
 * Ops holding user data that is not on the server.
 *
 * `pending` is work still queued; `failed` is work the server rejected. Both mean
 * "this device has data the cloud does not", which is the only question a
 * destructive action (sign-out wipe, account switch, snapshot apply) should ask.
 * Counting only `pending` is what let a rejected op be silently destroyed.
 */
export async function countUnsyncedOperations(): Promise<number> {
  const rows = await db.syncPendingOperations
    .where("status")
    .anyOf(["pending", "failed"])
    .count();
  return rows;
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

/**
 * Cutover / retry storms can enqueue many projection.upserts for the same row.
 * Keep the newest pending or failed upsert per entity; discard the rest.
 */
export async function collapseDuplicatePendingProjectionUpserts(): Promise<number> {
  const rows = (await listPendingOperations()).filter(
    (row) =>
      row.operation_type === "projection.upsert" &&
      (row.status === "pending" || row.status === "failed") &&
      typeof row.entity_id === "string" &&
      row.entity_id.length > 0
  );
  const groups = new Map<string, SyncPendingOperation[]>();
  for (const row of rows) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let discarded = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const keep = group[group.length - 1]!;
    for (const extra of group) {
      if (extra.id === keep.id) continue;
      await discardPendingOperation(extra.id);
      discarded += 1;
    }
    if (keep.status === "failed") {
      await db.syncPendingOperations.update(keep.id, {
        status: "pending",
        updated_at: now(),
      });
    }
  }
  return discarded;
}
