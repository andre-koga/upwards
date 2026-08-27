import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncPendingOperation } from "@/lib/db/types";

/**
 * The sign-out gate is the last thing standing between an unsynced write and
 * permanent loss, because sign-out ends in clearLocalSyncData() which clears every
 * synced table *and* the pending-op queue.
 *
 * The old version of this file only asserted that a hand-built result object had
 * the field values it was constructed with, which proved nothing. These tests run
 * the real gate against a fake queue.
 */

const pendingOps: SyncPendingOperation[] = [];
const rows: Array<{ synced_at: string | null; updated_at: string }> = [];

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {
      syncPendingOperations: {
        where: (index: string) => ({
          anyOf: (values: string[]) => ({
            count: async () =>
              pendingOps.filter(
                (op) => index !== "status" || values.includes(op.status)
              ).length,
            toArray: async () =>
              pendingOps.filter(
                (op) => index !== "status" || values.includes(op.status)
              ),
          }),
        }),
      },
    } as Record<string, unknown>,
    {
      // Every synced table shares one fake row set, so countUnsyncedRows can walk
      // SYNC_TABLES without each table needing its own stub.
      get: (target, prop: string) =>
        target[prop] ?? {
          filter: (
            predicate: (row: {
              synced_at: string | null;
              updated_at: string;
            }) => boolean
          ) => ({
            count: async () => rows.filter(predicate).length,
          }),
        },
    }
  ),
}));

const { getLocalSyncSafetyStatus } = await import("./unsynced-data");

function makeOp(status: SyncPendingOperation["status"]): SyncPendingOperation {
  return {
    id: `row-${pendingOps.length}`,
    operation_id: `op-${pendingOps.length}`,
    account_id: "user-1",
    device_id: "device-1",
    entity_type: "journal_entry",
    entity_id: "entity-1",
    operation_type: "projection.upsert",
    payload: {},
    base_revision: null,
    status,
    last_error: null,
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    acked_at: null,
  };
}

describe("local sync safety status", () => {
  beforeEach(() => {
    pendingOps.length = 0;
    rows.length = 0;
  });

  it("reports safe when nothing is queued and every row is synced", async () => {
    rows.push({
      synced_at: "2026-08-01T12:00:00.000Z",
      updated_at: "2026-08-01T12:00:00.000Z",
    });

    const status = await getLocalSyncSafetyStatus();
    expect(status.hasUnsyncedData).toBe(false);
  });

  it("blocks on a queued op", async () => {
    pendingOps.push(makeOp("pending"));

    const status = await getLocalSyncSafetyStatus();
    expect(status.pendingOpCount).toBe(1);
    expect(status.hasUnsyncedData).toBe(true);
  });

  it("blocks on a server-rejected op", async () => {
    // The regression this whole change exists for. A rejected op is `failed`, not
    // `pending`, so the old gate counted zero, reported success, and the wipe
    // destroyed the only copy of the row.
    pendingOps.push(makeOp("failed"));

    const status = await getLocalSyncSafetyStatus();
    expect(status.pendingOpCount).toBe(1);
    expect(status.hasUnsyncedData).toBe(true);
  });

  it("ignores ops that genuinely reached the server", async () => {
    pendingOps.push(makeOp("acked"), makeOp("discarded"));

    const status = await getLocalSyncSafetyStatus();
    expect(status.pendingOpCount).toBe(0);
    expect(status.hasUnsyncedData).toBe(false);
  });

  it("blocks on a row edited since its last sync, even with an empty queue", async () => {
    rows.push({
      synced_at: "2026-08-01T12:00:00.000Z",
      updated_at: "2026-08-02T12:00:00.000Z",
    });

    const status = await getLocalSyncSafetyStatus();
    expect(status.unsyncedRowCount).toBeGreaterThan(0);
    expect(status.hasUnsyncedData).toBe(true);
  });
});
