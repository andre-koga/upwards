import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

// The server's verdict for each operation id; anything not listed is accepted.
const verdicts = vi.hoisted(() => new Map<string, string>());
// Runs while a request is in flight, to model an edit made during the push.
const duringRequest = vi.hoisted(() => ({
  run: null as null | (() => Promise<void>),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: async (
      _name: string,
      args: { ops: Array<{ operation_id: string }> }
    ) => {
      await duringRequest.run?.();
      return {
        data: args.ops.map((op, i) => ({
          operation_id: op.operation_id,
          status: verdicts.get(op.operation_id) ?? "accepted",
          server_sequence: i + 1,
          detail: "rejected by test",
        })),
        error: null,
      };
    },
  },
  isSupabaseConfigured: true,
  getCachedUserId: () => "user-1",
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-a",
}));

import { db } from "@/lib/db";
import type { Activity } from "@/lib/db/types";
import { enqueuePendingOperation } from "./pending-operations";
import { pushPendingOperations } from "./sync-operations";
import { getLocalSyncSafetyStatus } from "./unsynced-data";

const T1 = "2026-10-01T10:00:00.000Z";
const T2 = "2026-10-05T10:00:00.000Z";

function activity(patch: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    group_id: "g1",
    name: "Run",
    routine: "daily",
    completion_target: 1,
    is_archived: false,
    completed_at: null,
    archived_at: null,
    tracks_time: true,
    is_pinned: false,
    order_index: null,
    created_at: T1,
    updated_at: T1,
    synced_at: T1,
    deleted_at: null,
    ...patch,
  };
}

async function queueUpsert(row: Activity) {
  return enqueuePendingOperation({
    operation_id: crypto.randomUUID(),
    account_id: "user-1",
    device_id: "device-a",
    entity_type: "activity",
    entity_id: row.id,
    operation_type: "projection.upsert",
    payload: { row },
  });
}

describe("what counts as unsynced", () => {
  beforeEach(async () => {
    await db.activities.clear();
    await db.dailyEntries.clear();
    await db.syncPendingOperations.clear();
    verdicts.clear();
    duringRequest.run = null;
  });

  /** Push, with the server answering `verdict` for this one operation. */
  async function push(opId: string, verdict = "accepted") {
    const op = await db.syncPendingOperations.get(opId);
    verdicts.set(op!.operation_id, verdict);
    await pushPendingOperations();
  }

  it("does not count an edited row once its operation was acknowledged", async () => {
    // The bug: edit a row (updated_at moves past synced_at), push it, server
    // accepts. Only a snapshot used to move synced_at, so this stayed "unsynced".
    const edited = activity({ updated_at: T2, synced_at: T1 });
    await db.activities.add(edited);
    const op = await queueUpsert(edited);

    expect((await getLocalSyncSafetyStatus()).hasUnsyncedData).toBe(true);

    await push(op.id);

    const status = await getLocalSyncSafetyStatus();
    expect(status.pendingOpCount).toBe(0);
    expect(status.unsyncedRowCount).toBe(0);
    expect(status.hasUnsyncedData).toBe(false);
    expect((await db.activities.get("a1"))?.synced_at).toBe(T2);
  });

  it("marks a newly created row as sent once acknowledged", async () => {
    const created = activity({ synced_at: null });
    await db.activities.add(created);
    const op = await queueUpsert(created);

    await push(op.id);

    expect((await db.activities.get("a1"))?.synced_at).toBe(T1);
    expect((await getLocalSyncSafetyStatus()).hasUnsyncedData).toBe(false);
  });

  it("keeps a row unsynced when a newer edit arrives during the push and is rejected", async () => {
    const first = activity({ updated_at: T2, synced_at: T1 });
    await db.activities.add(first);
    const firstOp = await queueUpsert(first);

    // The user edits the row again after the request left but before the reply.
    const second = {
      ...first,
      name: "Run far",
      updated_at: "2026-10-06T10:00:00.000Z",
    };
    duringRequest.run = async () => {
      duringRequest.run = null;
      await db.activities.put(second);
      // Rejected, so it is not sent on the push loop's next pass and cannot
      // paper over whether the older acknowledgement wrongly marked the row.
      verdicts.set((await queueUpsert(second)).operation_id, "error");
    };

    await push(firstOp.id);

    // The older version was acknowledged; the newer one must not be marked sent.
    expect((await db.activities.get("a1"))?.synced_at).toBe(T1);
    expect((await getLocalSyncSafetyStatus()).hasUnsyncedData).toBe(true);
  });

  it("still blocks on a row edited since its last sync with an empty queue", async () => {
    // Kept on purpose: an operation can be gone (discarded) while its data was
    // never sent, and this is the only thing that notices.
    await db.activities.add(activity({ updated_at: T2, synced_at: T1 }));

    const status = await getLocalSyncSafetyStatus();
    expect(status.pendingOpCount).toBe(0);
    expect(status.unsyncedRowCount).toBe(1);
    expect(status.hasUnsyncedData).toBe(true);
  });

  it("still counts a row that was never sent and has no operation", async () => {
    await db.activities.add(activity({ synced_at: null }));

    const status = await getLocalSyncSafetyStatus();
    expect(status.unsyncedRowCount).toBe(1);
    expect(status.hasUnsyncedData).toBe(true);
  });

  it("still counts a rejected operation, through the queue", async () => {
    const row = activity({ updated_at: T2, synced_at: T1 });
    await db.activities.add(row);
    const op = await queueUpsert(row);
    await push(op.id, "error");

    const status = await getLocalSyncSafetyStatus();
    expect(status.pendingOpCount).toBe(1);
    expect(status.hasUnsyncedData).toBe(true);
  });

  describe("daily entries", () => {
    const day = (patch: Record<string, unknown> = {}) => ({
      id: "d1",
      date: "2026-10-05",
      task_counts: { a1: 1 },
      paused_task_ids: [],
      is_break_day: false,
      completion_notes: {},
      completion_times: {},
      created_at: T1,
      updated_at: T2,
      synced_at: T1 as string | null,
      deleted_at: null,
      ...patch,
    });

    async function queueCount(date = "2026-10-05") {
      return enqueuePendingOperation({
        operation_id: crypto.randomUUID(),
        account_id: "user-1",
        device_id: "device-a",
        entity_type: "daily_entry",
        entity_id: "a1",
        operation_type: "count.delta",
        payload: { date, activity_id: "a1", delta: 1 },
      });
    }

    it("are sent once their last operation is acknowledged", async () => {
      await db.dailyEntries.add(day());
      const op = await queueCount();
      expect((await getLocalSyncSafetyStatus()).hasUnsyncedData).toBe(true);

      await push(op.id);

      expect((await db.dailyEntries.get("d1"))?.synced_at).toBe(T2);
      expect((await getLocalSyncSafetyStatus()).hasUnsyncedData).toBe(false);
    });

    it("stay unsynced when a newer operation for the same day arrives during the push and is rejected", async () => {
      await db.dailyEntries.add(day());
      const first = await queueCount();
      duringRequest.run = async () => {
        duringRequest.run = null;
        verdicts.set((await queueCount()).operation_id, "error");
      };

      await push(first.id);

      // The first was acknowledged, but a newer one is still waiting.
      expect((await db.dailyEntries.get("d1"))?.synced_at).toBe(T1);
      expect((await getLocalSyncSafetyStatus()).hasUnsyncedData).toBe(true);
    });

    it("stay unsynced while another operation for the same day was rejected", async () => {
      await db.dailyEntries.add(day());
      const first = await queueCount();
      const second = await queueCount();
      verdicts.set(second.operation_id, "error");
      await push(first.id);

      expect((await db.dailyEntries.get("d1"))?.synced_at).toBe(T1);
    });

    it("are not affected by an acknowledged operation for a different day", async () => {
      await db.dailyEntries.add(day());
      const other = await queueCount("2026-10-06");

      await push(other.id);

      expect((await db.dailyEntries.get("d1"))?.synced_at).toBe(T1);
    });
  });
});
