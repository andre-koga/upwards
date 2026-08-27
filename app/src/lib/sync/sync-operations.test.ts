import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncPendingOperation } from "@/lib/db/types";

const pendingOps: SyncPendingOperation[] = [];
const activityVersions: import("@/lib/db/types").ActivityDefinitionVersion[] =
  [];
const groupVersions: import("@/lib/db/types").GroupDefinitionVersion[] = [];
const activities: Array<{
  id: string;
  name?: string | null;
  updated_at?: string;
}> = [];
const activityGroups: Array<{
  id: string;
  name?: string;
  updated_at?: string;
}> = [];
const syncIssues: import("@/lib/db/types").SyncIssue[] = [];
const dailyEntries: Array<{
  id: string;
  date: string;
  task_counts: Record<string, number> | null;
  paused_task_ids: string[] | null;
  is_break_day: boolean | null;
  current_activity_id: string | null;
  completion_notes: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}> = [];
const journalEntries: import("@/lib/db/types").JournalEntry[] = [];

const rpcMock = vi.fn();

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
});

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
  getCachedUserId: () => "user-1",
}));

vi.mock("@/lib/activity/untimed-period", () => ({
  tombstoneUntimedPeriodsForActivityOnDay: vi.fn(async () => 0),
  isUntimedPeriod: (start: string, end: string | null) =>
    Boolean(end && start === end),
}));

vi.mock("@/lib/db", () => ({
  db: {
    syncPendingOperations: {
      toArray: async () => [...pendingOps],
      get: async (id: string) => pendingOps.find((op) => op.id === id),
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
        anyOf: (values: string[]) => ({
          count: async () =>
            pendingOps.filter((row) => {
              if (index === "status") return values.includes(row.status);
              return true;
            }).length,
        }),
      }),
      update: async (id: string, patch: Partial<SyncPendingOperation>) => {
        const row = pendingOps.find((op) => op.id === id);
        if (row) Object.assign(row, patch);
      },
    },
    activityDefinitionVersions: {
      put: async (row: import("@/lib/db/types").ActivityDefinitionVersion) => {
        const idx = activityVersions.findIndex((v) => v.id === row.id);
        if (idx >= 0) activityVersions[idx] = row;
        else activityVersions.push(row);
      },
      get: async (id: string) =>
        activityVersions.find((row) => row.id === id) ?? undefined,
      where: (index: string) => ({
        equals: (value: string) => ({
          filter: (
            predicate: (
              row: import("@/lib/db/types").ActivityDefinitionVersion
            ) => boolean
          ) => ({
            toArray: async () =>
              activityVersions.filter((row) => {
                if (index === "activity_id" && row.activity_id !== value) {
                  return false;
                }
                return predicate(row);
              }),
          }),
          toArray: async () =>
            activityVersions.filter((row) => {
              if (index === "activity_id") return row.activity_id === value;
              return true;
            }),
        }),
      }),
    },
    groupDefinitionVersions: {
      put: async (row: import("@/lib/db/types").GroupDefinitionVersion) => {
        const idx = groupVersions.findIndex((v) => v.id === row.id);
        if (idx >= 0) groupVersions[idx] = row;
        else groupVersions.push(row);
      },
      get: async (id: string) =>
        groupVersions.find((row) => row.id === id) ?? undefined,
      where: (index: string) => ({
        equals: (value: string) => ({
          filter: (
            predicate: (
              row: import("@/lib/db/types").GroupDefinitionVersion
            ) => boolean
          ) => ({
            toArray: async () =>
              groupVersions.filter((row) => {
                if (index === "group_id" && row.group_id !== value) {
                  return false;
                }
                return predicate(row);
              }),
          }),
          toArray: async () =>
            groupVersions.filter((row) => {
              if (index === "group_id") return row.group_id === value;
              return true;
            }),
        }),
      }),
    },
    activities: {
      get: async (id: string) => activities.find((row) => row.id === id),
      update: async (id: string, patch: Record<string, unknown>) => {
        const row = activities.find((a) => a.id === id);
        if (row) Object.assign(row, patch);
      },
    },
    activityGroups: {
      get: async (id: string) => activityGroups.find((row) => row.id === id),
      update: async (id: string, patch: Record<string, unknown>) => {
        const row = activityGroups.find((g) => g.id === id);
        if (row) Object.assign(row, patch);
      },
    },
    dailyEntries: {
      add: async (row: (typeof dailyEntries)[number]) => {
        dailyEntries.push(row);
      },
      get: async (id: string) =>
        dailyEntries.find((entry) => entry.id === id) ?? undefined,
      update: async (id: string, patch: Record<string, unknown>) => {
        const row = dailyEntries.find((entry) => entry.id === id);
        if (row) Object.assign(row, patch);
      },
      where: (index: string) => ({
        equals: (value: string) => {
          const matches = dailyEntries.filter((entry) => {
            if (index === "date") return entry.date === value;
            return false;
          });
          return {
            filter: (predicate: (entry: (typeof dailyEntries)[number]) => boolean) => ({
              first: async () => matches.find(predicate),
            }),
            first: async () => matches[0],
          };
        },
      }),
    },
    journalEntries: {
      filter: (
        predicate: (entry: import("@/lib/db/types").JournalEntry) => boolean
      ) => ({
        toArray: async () => journalEntries.filter(predicate),
      }),
    },
    syncIssues: {
      filter: (
        predicate: (issue: import("@/lib/db/types").SyncIssue) => boolean
      ) => ({
        first: async () => syncIssues.find(predicate) ?? undefined,
      }),
      where: (index: string) => ({
        equals: (value: string) => ({
          filter: (
            predicate: (issue: import("@/lib/db/types").SyncIssue) => boolean
          ) => ({
            first: async () =>
              syncIssues.find(
                (issue) =>
                  (index !== "status" || issue.status === value) &&
                  predicate(issue)
              ) ?? undefined,
            toArray: async () =>
              syncIssues.filter(
                (issue) =>
                  (index !== "status" || issue.status === value) &&
                  predicate(issue)
              ),
          }),
          toArray: async () =>
            syncIssues.filter(
              (issue) => index !== "status" || issue.status === value
            ),
        }),
      }),
      update: async (
        id: string,
        patch: Partial<import("@/lib/db/types").SyncIssue>
      ) => {
        const row = syncIssues.find((issue) => issue.id === id);
        if (row) Object.assign(row, patch);
      },
      add: async (row: import("@/lib/db/types").SyncIssue) => {
        syncIssues.push(row);
      },
    },
  },
  now: () => "2026-08-01T12:00:00.000Z",
  newId: () => "issue-new",
}));

vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "local-device",
}));

vi.mock("@/lib/session/day-reset", () => ({
  getEffectiveToday: () => "2026-08-01",
}));

import {
  applyAcceptedDailyEntryOp,
  buildActivityDefinitionVersionFromOp,
  isSyncOperationsRpcMissing,
  maxServerSequence,
  pushPendingOperations,
  pullAndApplyOperations,
  toSubmitSyncOperationInput,
} from "./sync-operations";
import { saveOpsRpcAvailable } from "./sync-storage";
import { MAX_PUSH_ATTEMPTS } from "./pending-operations";

function makePending(
  overrides: Partial<SyncPendingOperation> &
    Pick<SyncPendingOperation, "operation_id">
): SyncPendingOperation {
  return {
    id: overrides.id ?? `row-${overrides.operation_id}`,
    operation_id: overrides.operation_id,
    account_id: "user-1",
    device_id: overrides.device_id ?? "local-device",
    entity_type: overrides.entity_type ?? "activity_definition",
    entity_id: overrides.entity_id ?? "activity-1",
    operation_type: overrides.operation_type ?? "definition.update",
    payload: overrides.payload ?? {
      version_id: "ver-1",
      fields: { name: "Run" },
    },
    base_revision: overrides.base_revision ?? null,
    status: overrides.status ?? "pending",
    last_error: null,
    created_at: overrides.created_at ?? "2026-08-01T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-08-01T10:00:00.000Z",
    acked_at: null,
  };
}

describe("sync-operations helpers", () => {
  it("detects missing RPC errors", () => {
    expect(
      isSyncOperationsRpcMissing({
        code: "PGRST202",
        message: "Could not find the function public.submit_sync_operations",
      })
    ).toBe(true);
    expect(isSyncOperationsRpcMissing({ message: "network down" })).toBe(false);
  });

  it("computes max server sequence", () => {
    expect(maxServerSequence([1, 5, 3])).toBe(5);
    expect(maxServerSequence([undefined, null])).toBeUndefined();
  });

  it("builds submit payload from pending row", () => {
    const pending = makePending({ operation_id: "op-1" });
    expect(toSubmitSyncOperationInput(pending)).toEqual({
      operation_id: "op-1",
      device_id: "local-device",
      entity_type: "activity_definition",
      entity_id: "activity-1",
      operation_type: "definition.update",
      payload: pending.payload,
      base_revision: null,
    });
  });

  it("builds activity definition version from remote op", () => {
    const version = buildActivityDefinitionVersionFromOp({
      operation_id: "op-remote",
      device_id: "other-device",
      entity_type: "activity_definition",
      entity_id: "activity-1",
      operation_type: "definition.update",
      payload: {
        version_id: "ver-remote",
        effective_from: "2026-08-01",
        fields: { name: "Yoga", routine: "daily", group_id: "g-1" },
      },
      base_revision: null,
      status: "accepted",
      server_sequence: 42,
      created_at: "2026-08-01T11:00:00.000Z",
    });
    expect(version?.id).toBe("ver-remote");
    expect(version?.server_sequence).toBe(42);
    expect(version?.name).toBe("Yoga");
  });
});

describe("pushPendingOperations", () => {
  beforeEach(() => {
    pendingOps.length = 0;
    syncIssues.length = 0;
    storage.clear();
    rpcMock.mockReset();
  });

  it("skips when RPC is missing", async () => {
    pendingOps.push(makePending({ operation_id: "op-1" }));
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.submit_sync_operations",
      },
    });

    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: false, skipped: true });
    expect(pendingOps[0].status).toBe("pending");
  });

  it("keeps ops pending on transient network failure", async () => {
    pendingOps.push(makePending({ operation_id: "op-1", id: "row-transient" }));
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Failed to fetch" },
    });

    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: true, transient: true });
    expect(pendingOps[0].status).toBe("pending");
    expect(pendingOps[0].last_error).toBe("Failed to fetch");
  });

  it("acks accepted and duplicate results", async () => {
    pendingOps.push(
      makePending({ operation_id: "op-accepted", id: "row-1" }),
      makePending({ operation_id: "op-dup", id: "row-2" })
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-accepted",
          status: "accepted",
          server_sequence: 10,
        },
        { operation_id: "op-dup", status: "duplicate", server_sequence: 11 },
      ],
      error: null,
    });

    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: false, maxSequence: 11 });
    expect(pendingOps[0].status).toBe("acked");
    expect(pendingOps[1].status).toBe("acked");
  });

  it("records conflict and acks pending op", async () => {
    pendingOps.push(makePending({ operation_id: "op-conflict", id: "row-3" }));
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-conflict",
          status: "conflict",
          server_sequence: 12,
        },
      ],
      error: null,
    });

    const result = await pushPendingOperations();
    expect(result.failed).toBe(false);
    expect(pendingOps[0].status).toBe("acked");
    expect(syncIssues).toHaveLength(1);
    expect(syncIssues[0].kind).toBe("conflict");
    expect(syncIssues[0].operation_id).toBe("op-conflict");
    expect((syncIssues[0].payload as { kind?: string } | null)?.kind).toBe(
      "definition_conflict"
    );
  });

  it("reports a rejected op as a failed push, without aborting the rest of the batch", async () => {
    pendingOps.push(
      makePending({ operation_id: "op-ok", id: "row-ok" }),
      makePending({
        operation_id: "op-bad",
        id: "row-bad",
        entity_type: "activity_period",
        operation_type: "projection.upsert",
      })
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-ok",
          status: "accepted",
          server_sequence: 20,
        },
        {
          operation_id: "op-bad",
          status: "error",
          server_sequence: 0,
          detail:
            'insert or update on table "activity_periods" violates foreign key constraint',
        },
      ],
      error: null,
    });

    const result = await pushPendingOperations();
    // The good op must still land, but the push is NOT a success: `row-bad` holds
    // user data the server does not have. Reporting `failed: false` here is what
    // let the sign-out gate wipe that data.
    expect(result).toEqual({
      failed: true,
      perOpRejection: true,
      maxSequence: 20,
    });
    expect(pendingOps.find((row) => row.id === "row-ok")?.status).toBe("acked");
    expect(pendingOps.find((row) => row.id === "row-bad")?.status).toBe(
      "failed"
    );
    expect(pendingOps.find((row) => row.id === "row-bad")?.last_error).toMatch(
      /foreign key/
    );
    // And the user has to be able to find out.
    expect(
      syncIssues.some(
        (issue) => issue.kind === "error" && /rejected/i.test(issue.title)
      )
    ).toBe(true);
  });

  it("stops retrying a rejected op once it hits the attempt ceiling", async () => {
    pendingOps.push(
      makePending({
        operation_id: "op-bad",
        id: "row-bad",
        entity_type: "activity_period",
        operation_type: "projection.upsert",
      })
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-bad",
          status: "error",
          server_sequence: 0,
          detail: "violates foreign key constraint",
        },
      ],
      error: null,
    });

    for (let i = 0; i < MAX_PUSH_ATTEMPTS + 2; i += 1) {
      await pushPendingOperations();
    }

    const row = pendingOps.find((r) => r.id === "row-bad");
    // Never discarded: it still holds the user's data.
    expect(row?.status).toBe("failed");
    // But capped, rather than re-submitted forever on every sync tick.
    expect(row?.attempt_count).toBe(MAX_PUSH_ATTEMPTS);
  });

  it("submits parent entities before activity periods", async () => {
    pendingOps.push(
      makePending({
        operation_id: "op-period",
        id: "row-period",
        entity_type: "activity_period",
        operation_type: "projection.upsert",
        created_at: "2026-08-01T10:00:00.000Z",
      }),
      makePending({
        operation_id: "op-activity",
        id: "row-activity",
        entity_type: "activity",
        operation_type: "projection.upsert",
        created_at: "2026-08-01T11:00:00.000Z",
      })
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-activity",
          status: "accepted",
          server_sequence: 1,
        },
        {
          operation_id: "op-period",
          status: "accepted",
          server_sequence: 2,
        },
      ],
      error: null,
    });

    await pushPendingOperations();
    expect(
      rpcMock.mock.calls[0][1].ops.map(
        (op: { operation_id: string }) => op.operation_id
      )
    ).toEqual(["op-activity", "op-period"]);
  });

  it("retries a failed batch one op at a time", async () => {
    pendingOps.push(
      makePending({ operation_id: "op-a", id: "row-a" }),
      makePending({ operation_id: "op-b", id: "row-b" })
    );
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "insert or update on table activity_periods violates foreign key constraint",
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            operation_id: "op-a",
            status: "accepted",
            server_sequence: 1,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            operation_id: "op-b",
            status: "accepted",
            server_sequence: 2,
          },
        ],
        error: null,
      });

    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: false, maxSequence: 2 });
    expect(rpcMock).toHaveBeenCalledTimes(3);
    expect(pendingOps.every((row) => row.status === "acked")).toBe(true);
  });

  it("collapses duplicate projection upserts before submit", async () => {
    pendingOps.push(
      makePending({
        operation_id: "op-old",
        id: "row-old",
        entity_type: "activity",
        entity_id: "act-1",
        operation_type: "projection.upsert",
        created_at: "2026-08-01T10:00:00.000Z",
      }),
      makePending({
        operation_id: "op-new",
        id: "row-new",
        entity_type: "activity",
        entity_id: "act-1",
        operation_type: "projection.upsert",
        created_at: "2026-08-01T11:00:00.000Z",
      })
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-new",
          status: "accepted",
          server_sequence: 1,
        },
      ],
      error: null,
    });

    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: false, maxSequence: 1 });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][1]).toMatchObject({
      ops: [{ operation_id: "op-new" }],
    });
    expect(pendingOps.find((row) => row.id === "row-old")?.status).toBe(
      "discarded"
    );
    expect(pendingOps.find((row) => row.id === "row-new")?.status).toBe("acked");
  });

  it("submits pending ops in bounded batches", async () => {
    for (let i = 0; i < 51; i += 1) {
      pendingOps.push(
        makePending({
          operation_id: `op-${i}`,
          id: `row-${i}`,
          created_at: `2026-08-01T10:00:${String(i).padStart(2, "0")}.000Z`,
        })
      );
    }
    let sequence = 0;
    rpcMock.mockImplementation(async (_fn: string, args: { ops: Array<{ operation_id: string }> }) => ({
      data: args.ops.map((op) => ({
        operation_id: op.operation_id,
        status: "accepted",
        server_sequence: ++sequence,
      })),
      error: null,
    }));

    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: false, maxSequence: 51 });
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0][1].ops).toHaveLength(50);
    expect(rpcMock.mock.calls[1][1].ops).toHaveLength(1);
    expect(pendingOps.every((row) => row.status === "acked")).toBe(true);
  });
});

describe("pullAndApplyOperations", () => {
  beforeEach(() => {
    activityVersions.length = 0;
    groupVersions.length = 0;
    activities.length = 0;
    activityGroups.length = 0;
    syncIssues.length = 0;
    dailyEntries.length = 0;
    storage.clear();
    rpcMock.mockReset();
    activities.push({ id: "activity-1", name: "Old" });
  });

  it("skips when RPC is missing", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.pull_sync_operations",
      },
    });

    const result = await pullAndApplyOperations(0);
    expect(result).toEqual({ skipped: true });
  });

  it("applies remote accepted definition ops from other devices", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-remote",
          device_id: "other-device",
          entity_type: "activity_definition",
          entity_id: "activity-1",
          operation_type: "definition.update",
          payload: {
            version_id: "ver-remote",
            effective_from: "2026-08-01",
            fields: { name: "Yoga" },
          },
          base_revision: null,
          status: "accepted",
          server_sequence: 20,
          created_at: "2026-08-01T11:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await pullAndApplyOperations(5);
    expect(result.maxSequence).toBe(20);
    expect(activityVersions).toHaveLength(0);
    expect(activities[0].name).toBe("Yoga");
  });

  it("creates conflict issue for remote conflict ops", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-conflict-remote",
          device_id: "other-device",
          entity_type: "activity_definition",
          entity_id: "activity-1",
          operation_type: "definition.update",
          payload: {},
          base_revision: "ver-old",
          status: "conflict",
          server_sequence: 21,
          created_at: "2026-08-01T11:00:00.000Z",
        },
      ],
      error: null,
    });

    await pullAndApplyOperations(10);
    expect(syncIssues).toHaveLength(1);
    expect(syncIssues[0].operation_id).toBe("op-conflict-remote");
    expect((syncIssues[0].payload as { kind?: string } | null)?.kind).toBe(
      "definition_conflict"
    );
  });

  it("applies remote daily_entry count deltas from other devices", async () => {
    dailyEntries.push({
      id: "entry-1",
      date: "2026-08-01",
      task_counts: { "activity-1": 1 },
      paused_task_ids: [],
      is_break_day: false,
      current_activity_id: null,
      completion_notes: {},
      created_at: "2026-08-01T10:00:00.000Z",
      updated_at: "2026-08-01T10:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    });

    rpcMock.mockResolvedValue({
      data: [
        {
          operation_id: "op-count-remote",
          device_id: "other-device",
          entity_type: "daily_entry",
          entity_id: "activity-1",
          operation_type: "count.delta",
          payload: {
            activity_id: "activity-1",
            date: "2026-08-01",
            delta: 1,
          },
          base_revision: null,
          status: "accepted",
          server_sequence: 30,
          created_at: "2026-08-01T11:00:00.000Z",
        },
      ],
      error: null,
    });

    await pullAndApplyOperations(10);
    expect(dailyEntries[0].task_counts).toEqual({ "activity-1": 2 });
  });
});

describe("applyAcceptedDailyEntryOp", () => {
  beforeEach(() => {
    dailyEntries.length = 0;
  });

  it("merges pause and break-day ops into a new local entry", async () => {
    await applyAcceptedDailyEntryOp({
      operation_id: "op-pause",
      device_id: "other-device",
      entity_type: "daily_entry",
      entity_id: "activity-1",
      operation_type: "pause.enable",
      payload: { activity_id: "activity-1", date: "2026-08-02", paused: true },
      base_revision: null,
      status: "accepted",
      server_sequence: 1,
      created_at: "2026-08-01T12:00:00.000Z",
    });

    expect(dailyEntries).toHaveLength(1);
    expect(dailyEntries[0].paused_task_ids).toEqual(["activity-1"]);

    await applyAcceptedDailyEntryOp({
      operation_id: "op-break",
      device_id: "other-device",
      entity_type: "daily_entry",
      entity_id: null,
      operation_type: "break_day.enable",
      payload: { date: "2026-08-02", is_break_day: true },
      base_revision: null,
      status: "accepted",
      server_sequence: 2,
      created_at: "2026-08-01T12:01:00.000Z",
    });

    expect(dailyEntries[0].is_break_day).toBe(true);
  });
});

describe("ops rpc availability gating", () => {
  beforeEach(() => {
    pendingOps.length = 0;
    storage.clear();
    rpcMock.mockReset();
  });

  it("reports skipped only when the client is unavailable", async () => {
    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: false });
  });

  it("reports active when no pending ops but RPCs were previously available", async () => {
    saveOpsRpcAvailable(true);
    const result = await pushPendingOperations();
    expect(result).toEqual({ failed: false });
  });
});
