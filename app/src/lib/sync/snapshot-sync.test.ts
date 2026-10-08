import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, pending, conflicts } = vi.hoisted(() => ({
  tables: {
    journalEntries: [] as Array<Record<string, unknown>>,
    dailyEntries: [] as Array<Record<string, unknown>>,
  },
  pending: [] as Array<{ entity_id: string }>,
  conflicts: new Set<string>(),
}));

vi.mock("./pending-operations", () => ({
  listUnsyncedOperations: async () => [...pending],
}));

vi.mock("./sync-issues-store", () => ({
  listOpenConflictEntityIds: async () => new Set(conflicts),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  getCachedUserId: () => "user-1",
}));

vi.mock("@/lib/db", () => {
  const empty = () => ({
    toArray: async () => [],
    bulkDelete: async () => {},
    bulkPut: async () => {},
  });
  const backed = (rows: Array<Record<string, unknown>>) => ({
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
  });
  return {
    db: {
      journalEntries: backed(tables.journalEntries),
      dailyEntries: backed(tables.dailyEntries),
      activityGroups: empty(),
      activities: empty(),
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
    tables.dailyEntries.length = 0;
    pending.length = 0;
    conflicts.clear();
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

  it("keeps local rows the server snapshot does not carry", async () => {
    // The snapshot is a repair pass, not a delete authority. A row missing from
    // the server may be unpushed local work, and the pending-op gate cannot
    // prove otherwise: a server-rejected op is marked `failed`, not `pending`.
    tables.journalEntries.push({
      id: "journal-user-1-2026-08-21",
      user_id: "user-1",
      entry_date: "2026-08-21",
      content: "not yet pushed",
      deleted_at: null,
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    await applySyncSnapshot({ server_sequence: 43, journal_entries: [] });

    expect(tables.journalEntries).toHaveLength(1);
    expect(tables.journalEntries[0]!.content).toBe("not yet pushed");
  });

  it("does not overwrite op-owned daily entry counts", async () => {
    // task_counts belongs to the semantic op stream. A snapshot that writes the
    // server's copy over a local one silently discards untimed completions,
    // whose only representation is the count itself.
    tables.dailyEntries.push({
      id: "daily-user-1-2026-08-25",
      user_id: "user-1",
      date: "2026-08-25",
      task_counts: { "activity-1": 3 },
      is_break_day: false,
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    await applySyncSnapshot({
      server_sequence: 44,
      daily_entries: [
        {
          id: "daily-user-1-2026-08-25",
          user_id: "user-1",
          date: "2026-08-25",
          task_counts: {},
          is_break_day: false,
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      ],
    });

    expect(tables.dailyEntries).toHaveLength(1);
    expect(tables.dailyEntries[0]!.task_counts).toEqual({ "activity-1": 3 });
  });

  it("refuses an incoming tombstone for a live local journal entry with text", async () => {
    // The mirror of "keeps local rows the server snapshot does not carry". That
    // rule stops an *absent* server row from deleting local work, but the merge
    // let incoming fields win, so an incoming tombstone still deleted it. The app
    // has no user-facing journal delete, so such a tombstone is always
    // machine-written (production holds 54, 53 carrying text) and never reflects
    // an intent to delete.
    tables.journalEntries.push({
      id: "journal-user-1-2026-08-22",
      user_id: "user-1",
      entry_date: "2026-08-22",
      text_content: "a long entry I typed on this phone",
      deleted_at: null,
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    await applySyncSnapshot({
      server_sequence: 45,
      journal_entries: [
        {
          id: "journal-user-1-2026-08-22",
          user_id: "user-1",
          entry_date: "2026-08-22",
          text_content: null,
          deleted_at: "2026-08-27T00:00:00.000Z",
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      ],
    });

    expect(tables.journalEntries).toHaveLength(1);
    expect(tables.journalEntries[0]!.deleted_at).toBeNull();
    expect(tables.journalEntries[0]!.text_content).toBe(
      "a long entry I typed on this phone"
    );
  });

  it("accepts an incoming tombstone for an empty local journal entry", async () => {
    // Refusing every delete would resurrect rows forever. An empty local row has
    // nothing to lose, and dedupe legitimately tombstones these.
    tables.journalEntries.push({
      id: "journal-user-1-2026-08-23",
      user_id: "user-1",
      entry_date: "2026-08-23",
      text_content: null,
      photo_paths: [],
      deleted_at: null,
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    await applySyncSnapshot({
      server_sequence: 46,
      journal_entries: [
        {
          id: "journal-user-1-2026-08-23",
          user_id: "user-1",
          entry_date: "2026-08-23",
          deleted_at: "2026-08-27T00:00:00.000Z",
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      ],
    });

    expect(tables.journalEntries[0]!.deleted_at).toBe(
      "2026-08-27T00:00:00.000Z"
    );
  });

  it("protects a media-only journal entry, which carries no text at all", async () => {
    tables.journalEntries.push({
      id: "journal-user-1-2026-08-24",
      user_id: "user-1",
      entry_date: "2026-08-24",
      text_content: null,
      photo_paths: ["photo-a.jpg"],
      deleted_at: null,
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    await applySyncSnapshot({
      server_sequence: 47,
      journal_entries: [
        {
          id: "journal-user-1-2026-08-24",
          user_id: "user-1",
          entry_date: "2026-08-24",
          deleted_at: "2026-08-27T00:00:00.000Z",
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      ],
    });

    expect(tables.journalEntries[0]!.deleted_at).toBeNull();
  });

  it("still accepts a tombstone for a row this device already deleted", async () => {
    tables.journalEntries.push({
      id: "journal-user-1-2026-08-19",
      user_id: "user-1",
      entry_date: "2026-08-19",
      text_content: "old text",
      deleted_at: "2026-08-25T00:00:00.000Z",
      updated_at: "2026-08-25T00:00:00.000Z",
    });

    await applySyncSnapshot({
      server_sequence: 48,
      journal_entries: [
        {
          id: "journal-user-1-2026-08-19",
          user_id: "user-1",
          entry_date: "2026-08-19",
          deleted_at: "2026-08-27T00:00:00.000Z",
          updated_at: "2026-08-27T00:00:00.000Z",
        },
      ],
    });

    expect(tables.journalEntries[0]!.deleted_at).toBe(
      "2026-08-27T00:00:00.000Z"
    );
  });

  describe("after the A8b re-key", () => {
    const SYNCED = "2026-10-08T00:00:00.000Z";
    const oldJournal = (extra: Record<string, unknown> = {}) => ({
      id: "old-journal-id",
      user_id: "user-1",
      entry_date: "2026-01-01",
      text_content: "kept text",
      is_journal_complete: true,
      journal_entry_number: 7,
      deleted_at: null,
      updated_at: SYNCED,
      synced_at: SYNCED,
      ...extra,
    });
    const serverJournal = {
      id: "natural-journal-id",
      user_id: "user-1",
      entry_date: "2026-01-01",
      text_content: "kept text",
      deleted_at: null,
      updated_at: SYNCED,
    };

    it("retires a synced local copy the server now holds under its natural id", async () => {
      tables.journalEntries.push(oldJournal());
      tables.dailyEntries.push({
        id: "old-daily-id",
        user_id: "user-1",
        date: "2026-01-01",
        task_counts: { a: 1 },
        current_activity_id: "a",
        updated_at: SYNCED,
        synced_at: SYNCED,
      });

      await applySyncSnapshot({
        server_sequence: 50,
        journal_entries: [serverJournal],
        daily_entries: [
          {
            id: "natural-daily-id",
            user_id: "user-1",
            date: "2026-01-01",
            task_counts: { a: 1 },
            updated_at: SYNCED,
          },
        ],
      });

      expect(tables.journalEntries.map((r) => r.id)).toEqual([
        "natural-journal-id",
      ]);
      expect(tables.journalEntries[0]!.text_content).toBe("kept text");
      expect(tables.dailyEntries.map((r) => r.id)).toEqual([
        "natural-daily-id",
      ]);
    });

    it.each([
      ["never synced", { synced_at: null }],
      [
        "edited since its last sync",
        { updated_at: "2026-10-09T00:00:00.000Z" },
      ],
    ])("keeps a local copy that was %s", async (_label, extra) => {
      tables.journalEntries.push(oldJournal(extra));

      await applySyncSnapshot({
        server_sequence: 51,
        journal_entries: [serverJournal],
      });

      expect(tables.journalEntries.map((r) => r.id).sort()).toEqual([
        "natural-journal-id",
        "old-journal-id",
      ]);
    });

    it("keeps a local copy with a queued op or an open conflict", async () => {
      tables.journalEntries.push(
        oldJournal(),
        oldJournal({ id: "conflicted-id", entry_date: "2026-01-02" })
      );
      pending.push({ entity_id: "old-journal-id" });
      conflicts.add("conflicted-id");

      await applySyncSnapshot({
        server_sequence: 52,
        journal_entries: [
          serverJournal,
          { ...serverJournal, id: "natural-2", entry_date: "2026-01-02" },
        ],
      });

      expect(tables.journalEntries.map((r) => r.id).sort()).toEqual([
        "conflicted-id",
        "natural-2",
        "natural-journal-id",
        "old-journal-id",
      ]);
    });

    it("strips dropped columns from a local row the snapshot updates", async () => {
      tables.journalEntries.push(oldJournal({ id: "natural-journal-id" }));

      await applySyncSnapshot({
        server_sequence: 53,
        journal_entries: [serverJournal],
      });

      expect(tables.journalEntries).toHaveLength(1);
      expect(tables.journalEntries[0]).not.toHaveProperty(
        "is_journal_complete"
      );
      expect(tables.journalEntries[0]).not.toHaveProperty(
        "journal_entry_number"
      );
    });
  });
});
