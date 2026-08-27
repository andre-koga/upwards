import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables } = vi.hoisted(() => ({
  tables: {
    journalEntries: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  getCachedUserId: () => "user-1",
}));

vi.mock("@/lib/db", () => {
  const rows = tables.journalEntries;
  const empty = () => ({
    toArray: async () => [],
    bulkDelete: async () => {},
    bulkPut: async () => {},
  });
  return {
    db: {
      journalEntries: {
        toArray: async () => [...rows],
        bulkDelete: async (ids: string[]) => {
          for (const id of ids) {
            const idx = rows.findIndex((r) => r.id === id);
            if (idx >= 0) rows.splice(idx, 1);
          }
        },
        bulkPut: async (incoming: Array<Record<string, unknown>>) => {
          for (const row of incoming) {
            const idx = rows.findIndex((r) => r.id === row.id);
            if (idx >= 0) rows[idx] = row;
            else rows.push(row);
          }
        },
      },
      activityGroups: empty(),
      activities: empty(),
      dailyEntries: empty(),
      activityPeriods: empty(),
      oneTimeTasks: empty(),
      recurringMemos: empty(),
      activityStatusEvents: empty(),
      groupStatusEvents: empty(),
    },
    now: () => "2026-08-27T00:00:00.000Z",
  };
});

vi.mock("./projection-sync", () => ({
  withSuppressedProjectionEnqueue: async (fn: () => Promise<void>) => {
    await fn();
  },
}));

import { applySyncSnapshot } from "./snapshot-sync";

describe("applySyncSnapshot", () => {
  beforeEach(() => {
    tables.journalEntries.length = 0;
  });

  it("clears a local tombstone when the server row is live", async () => {
    // Reproduces the natural-id cutover damage: the server healed the row, but
    // this device still has it soft-deleted, so the entry stays hidden. The op
    // stream carries deltas and never revisits the row, so only a snapshot can
    // repair it.
    tables.journalEntries.push({
      id: "journal-user-1-2026-08-20",
      user_id: "user-1",
      entry_date: "2026-08-20",
      content: "",
      deleted_at: "2026-08-26T00:00:00.000Z",
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    await applySyncSnapshot({
      server_sequence: 42,
      journal_entries: [
        {
          id: "journal-user-1-2026-08-20",
          user_id: "user-1",
          entry_date: "2026-08-20",
          content: "the entry I thought I lost",
          deleted_at: null,
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      ],
    });

    expect(tables.journalEntries).toHaveLength(1);
    const row = tables.journalEntries[0]!;
    expect(row.deleted_at).toBeNull();
    expect(row.content).toBe("the entry I thought I lost");
  });

  it("removes local rows the server no longer has", async () => {
    tables.journalEntries.push({
      id: "journal-user-1-2026-08-21",
      user_id: "user-1",
      entry_date: "2026-08-21",
      content: "deleted on another device",
      deleted_at: null,
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    await applySyncSnapshot({ server_sequence: 43, journal_entries: [] });

    expect(tables.journalEntries).toHaveLength(0);
  });
});
