import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncPendingOperation } from "@/lib/db/types";

const pendingOps: SyncPendingOperation[] = [];

vi.mock("@/lib/db", () => ({
  db: {
    syncPendingOperations: {
      where: (index: string) => ({
        equals: (value: string) => ({
          toArray: async () =>
            pendingOps.filter(
              (op) => index !== "status" || op.status === value
            ),
        }),
      }),
      update: async (id: string, patch: Partial<SyncPendingOperation>) => {
        const row = pendingOps.find((op) => op.id === id);
        if (row) Object.assign(row, patch);
      },
    },
  },
  now: () => "2026-10-02T12:00:00.000Z",
}));

const {
  ClientOutdatedError,
  getObservedDataEpoch,
  isClientOutdatedError,
  readDataEpoch,
  recordObservedDataEpoch,
  requeueClientOutdatedOperations,
  resetObservedDataEpochForTests,
  throwIfClientOutdated,
} = await import("./release-gate");

function makeOp(
  overrides: Partial<SyncPendingOperation>
): SyncPendingOperation {
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
    status: "pending",
    last_error: null,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
    acked_at: null,
    ...overrides,
  };
}

describe("client_outdated detection", () => {
  it("recognizes the PostgREST error the gate raises", () => {
    expect(
      isClientOutdatedError({
        code: "P0001",
        message: "client_outdated",
        details: "client_protocol=0 min_client_protocol=1",
      })
    ).toBe(true);
  });

  it("recognizes the message an older build stored on a failed op", () => {
    expect(isClientOutdatedError("client_outdated")).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isClientOutdatedError({ message: "Failed to fetch" })).toBe(false);
    expect(isClientOutdatedError(new Error("boom"))).toBe(false);
    expect(isClientOutdatedError(null)).toBe(false);
  });

  it("throws a typed error so callers can skip marking ops failed", () => {
    expect(() =>
      throwIfClientOutdated({ message: "client_outdated" })
    ).toThrow(ClientOutdatedError);
    expect(() =>
      throwIfClientOutdated({ message: "permission denied" })
    ).not.toThrow();
  });
});

describe("data epoch tracking", () => {
  beforeEach(() => resetObservedDataEpochForTests());

  it("reads the epoch from gated RPC responses only", () => {
    expect(readDataEpoch({ results: [], data_epoch: 3 })).toBe(3);
    expect(readDataEpoch({ data_epoch: "2" })).toBe(2);
    expect(readDataEpoch([{ operation_id: "op" }])).toBeUndefined();
    expect(readDataEpoch({ data_epoch: -1 })).toBeUndefined();
    expect(readDataEpoch(null)).toBeUndefined();
  });

  it("keeps the highest epoch seen", () => {
    recordObservedDataEpoch(2);
    recordObservedDataEpoch(1);
    recordObservedDataEpoch(undefined);
    expect(getObservedDataEpoch()).toBe(2);
  });
});

describe("requeueClientOutdatedOperations", () => {
  beforeEach(() => {
    pendingOps.length = 0;
  });

  it("restores ops an older build stranded past the retry ceiling", async () => {
    pendingOps.push(
      makeOp({
        id: "stranded",
        status: "failed",
        last_error: "client_outdated",
        attempt_count: 9,
      })
    );

    expect(await requeueClientOutdatedOperations()).toBe(1);
    expect(pendingOps[0]).toMatchObject({
      status: "pending",
      attempt_count: 0,
      last_error: null,
    });
  });

  it("leaves genuine rejections alone", async () => {
    pendingOps.push(
      makeOp({
        id: "rejected",
        status: "failed",
        last_error: "violates foreign key constraint",
        attempt_count: 5,
      })
    );

    expect(await requeueClientOutdatedOperations()).toBe(0);
    expect(pendingOps[0]).toMatchObject({ status: "failed", attempt_count: 5 });
  });
});
