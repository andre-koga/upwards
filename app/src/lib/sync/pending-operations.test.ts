import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncPendingOperation } from "@/lib/db/types";

const pendingOps: SyncPendingOperation[] = [];
let idCounter = 0;

vi.mock("@/lib/db", () => ({
  db: {
    syncPendingOperations: {
      add: async (row: SyncPendingOperation) => {
        pendingOps.push(row);
      },
      toArray: async () => [...pendingOps],
      where: (index: string) => ({
        equals: (value: string) => ({
          toArray: async () =>
            pendingOps.filter((row) => {
              if (index === "status") return row.status === value;
              return true;
            }),
          count: async () =>
            pendingOps.filter((row) => {
              if (index === "status") return row.status === value;
              return true;
            }).length,
        }),
      }),
      count: async () => pendingOps.length,
      update: async (id: string, patch: Partial<SyncPendingOperation>) => {
        const row = pendingOps.find((op) => op.id === id);
        if (row) Object.assign(row, patch);
      },
    },
  },
  newId: () => `op-row-${++idCounter}`,
  now: () => "2026-08-01T12:00:00.000Z",
}));

import {
  enqueuePendingOperation,
  listPendingOperations,
  countPendingOperations,
  markOperationAcked,
  markOperationFailed,
  discardPendingOperation,
} from "./pending-operations";

describe("pending-operations", () => {
  beforeEach(() => {
    pendingOps.length = 0;
    idCounter = 0;
  });

  it("enqueuePendingOperation adds a pending row", async () => {
    const row = await enqueuePendingOperation({
      operation_id: "op-1",
      device_id: "device-1",
      entity_type: "activity",
      operation_type: "increment",
      payload: { delta: 1 },
    });

    expect(row.status).toBe("pending");
    expect(row.operation_id).toBe("op-1");
    expect(pendingOps.length).toBe(1);
  });

  it("listPendingOperations filters by status", async () => {
    const row = await enqueuePendingOperation({
      operation_id: "op-1",
      device_id: "device-1",
      entity_type: "activity",
      operation_type: "increment",
      payload: {},
    });
    await markOperationAcked(row.id);

    await enqueuePendingOperation({
      operation_id: "op-2",
      device_id: "device-1",
      entity_type: "activity",
      operation_type: "increment",
      payload: {},
    });

    const pending = await listPendingOperations({ status: "pending" });
    expect(pending.length).toBe(1);
    expect(pending[0].operation_id).toBe("op-2");
  });

  it("countPendingOperations returns pending count", async () => {
    await enqueuePendingOperation({
      operation_id: "op-1",
      device_id: "device-1",
      entity_type: "activity",
      operation_type: "increment",
      payload: {},
    });
    expect(await countPendingOperations({ status: "pending" })).toBe(1);
  });

  it("markOperationFailed and discardPendingOperation update status", async () => {
    const row = await enqueuePendingOperation({
      operation_id: "op-1",
      device_id: "device-1",
      entity_type: "activity",
      operation_type: "increment",
      payload: {},
    });

    await markOperationFailed(row.id, "network");
    expect(pendingOps[0].status).toBe("failed");
    expect(pendingOps[0].last_error).toBe("network");

    await discardPendingOperation(row.id);
    expect(pendingOps[0].status).toBe("discarded");
  });
});
