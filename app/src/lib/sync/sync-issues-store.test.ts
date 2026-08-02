import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncIssue } from "@/lib/db/types";

const syncIssues: SyncIssue[] = [];
let idCounter = 0;

vi.mock("@/lib/db", () => ({
  db: {
    syncIssues: {
      add: async (row: SyncIssue) => {
        syncIssues.push(row);
      },
      toArray: async () => [...syncIssues],
      where: (index: string) => ({
        equals: (value: string) => {
          const matched = syncIssues.filter((issue) => {
            if (index === "status") return issue.status === value;
            if (index === "kind") return issue.kind === value;
            return true;
          });
          return {
            toArray: async () => matched,
            filter: (predicate: (issue: SyncIssue) => boolean) => ({
              first: async () => matched.find(predicate),
            }),
            count: async () => matched.length,
          };
        },
      }),
      update: async (id: string, patch: Partial<SyncIssue>) => {
        const row = syncIssues.find((issue) => issue.id === id);
        if (row) Object.assign(row, patch);
      },
    },
  },
  newId: () => `issue-${++idCounter}`,
  now: () => "2026-08-01T12:00:00.000Z",
}));

import {
  recordSyncIssue,
  listSyncIssues,
  countOpenSyncIssues,
  resolveSyncIssue,
  deferSyncIssue,
} from "./sync-issues-store";

describe("sync-issues-store", () => {
  beforeEach(() => {
    syncIssues.length = 0;
    idCounter = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recordSyncIssue creates an open issue", async () => {
    const issue = await recordSyncIssue({
      kind: "error",
      title: "Sync error",
      detail: "Network down",
    });

    expect(issue.kind).toBe("error");
    expect(issue.status).toBe("open");
    expect(syncIssues.length).toBe(1);
  });

  it("dedupes identical open errors within the window", async () => {
    const first = await recordSyncIssue({
      kind: "error",
      title: "Sync error",
      detail: "Network down",
    });
    const second = await recordSyncIssue({
      kind: "error",
      title: "Sync error",
      detail: "Network down",
    });

    expect(second.id).toBe(first.id);
    expect(syncIssues.length).toBe(1);
  });

  it("listSyncIssues filters by kind and status", async () => {
    await recordSyncIssue({
      kind: "conflict",
      title: "Conflict",
      detail: "Name mismatch",
    });
    await recordSyncIssue({
      kind: "error",
      title: "Sync error",
      detail: "Auth failed",
    });

    const conflicts = await listSyncIssues({
      kind: "conflict",
      status: "open",
    });
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].kind).toBe("conflict");
  });

  it("resolveSyncIssue and deferSyncIssue update status", async () => {
    const issue = await recordSyncIssue({
      kind: "error",
      title: "Sync error",
      detail: "Oops",
    });

    await resolveSyncIssue(issue.id);
    expect(syncIssues[0].status).toBe("resolved");
    expect(syncIssues[0].resolved_at).toBe("2026-08-01T12:00:00.000Z");
    expect(await countOpenSyncIssues()).toBe(0);

    const deferred = await recordSyncIssue({
      kind: "conflict",
      title: "Conflict",
      detail: "Later",
    });
    await deferSyncIssue(deferred.id);
    expect(syncIssues.find((row) => row.id === deferred.id)?.status).toBe(
      "deferred"
    );
  });
});
