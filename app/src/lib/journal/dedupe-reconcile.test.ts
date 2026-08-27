import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry, SyncPendingOperation } from "@/lib/db/types";

/**
 * The pure merge helpers are covered in dedupe-by-date.test.ts. This file covers
 * the side effects, which are what actually destroy data: the loser tombstone and
 * the disposal of the loser's queued sync ops.
 */

const journalEntries: JournalEntry[] = [];
const pendingOps: SyncPendingOperation[] = [];
const discarded: string[] = [];
const recordedIssues: Array<{ kind: string; title: string }> = [];
let openConflictIds = new Set<string>();

vi.mock("@/lib/db", () => ({
  db: {
    journalEntries: {
      where: () => ({
        equals: (value: string) => ({
          filter: (predicate: (e: JournalEntry) => boolean) => ({
            toArray: async () =>
              journalEntries.filter(
                (e) => e.entry_date === value && predicate(e)
              ),
          }),
        }),
      }),
      put: async (row: JournalEntry) => {
        const idx = journalEntries.findIndex((e) => e.id === row.id);
        if (idx >= 0) journalEntries[idx] = row;
        else journalEntries.push(row);
      },
      update: async (id: string, patch: Partial<JournalEntry>) => {
        const row = journalEntries.find((e) => e.id === id);
        if (row) Object.assign(row, patch);
      },
      delete: async (id: string) => {
        const idx = journalEntries.findIndex((e) => e.id === id);
        if (idx >= 0) journalEntries.splice(idx, 1);
      },
    },
    syncPendingOperations: {
      filter: (predicate: (op: SyncPendingOperation) => boolean) => ({
        toArray: async () => pendingOps.filter(predicate),
      }),
    },
  },
  now: () => "2026-08-26T10:00:00.000Z",
}));

vi.mock("@/lib/sync/projection-sync", () => ({
  enqueueProjectionUpsertForTable: async () => {},
  withSuppressedProjectionEnqueue: async (fn: () => Promise<void>) => fn(),
}));

vi.mock("@/lib/sync/pending-operations", () => ({
  discardPendingOperation: async (id: string) => {
    discarded.push(id);
    const row = pendingOps.find((op) => op.id === id);
    if (row) row.status = "discarded";
  },
}));

vi.mock("@/lib/sync/sync-issues-store", () => ({
  recordSyncIssue: async (input: { kind: string; title: string }) => {
    recordedIssues.push(input);
    return { id: "issue-1" };
  },
  listOpenConflictEntityIds: async () => openConflictIds,
}));

const { reconcileJournalDuplicatesForDate } = await import("./dedupe-by-date");

function makeEntry(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: "entry",
    entry_date: "2026-08-25",
    title: null,
    text_content: null,
    day_emoji: null,
    is_bookmarked: null,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    is_journal_complete: null,
    journal_entry_number: null,
    journal_completion_streak: null,
    journal_completed_at: null,
    location: null,
    created_at: "2026-08-25T10:00:00.000Z",
    updated_at: "2026-08-25T10:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function makeOp(entityId: string, status: SyncPendingOperation["status"]) {
  const op: SyncPendingOperation = {
    id: `op-row-${pendingOps.length}`,
    operation_id: `op-${pendingOps.length}`,
    account_id: "user-1",
    device_id: "device-1",
    entity_type: "journal_entry",
    entity_id: entityId,
    operation_type: "projection.upsert",
    payload: {},
    base_revision: null,
    status,
    last_error: null,
    created_at: "2026-08-25T10:00:00.000Z",
    updated_at: "2026-08-25T10:00:00.000Z",
    acked_at: null,
  };
  pendingOps.push(op);
  return op;
}

describe("reconcileJournalDuplicatesForDate", () => {
  beforeEach(() => {
    journalEntries.length = 0;
    pendingOps.length = 0;
    discarded.length = 0;
    recordedIssues.length = 0;
    openConflictIds = new Set();
  });

  it("tombstones a synced empty duplicate and keeps the content", async () => {
    journalEntries.push(
      makeEntry({
        id: "filled",
        text_content: "Real writing",
        synced_at: "2026-08-25T10:00:00.000Z",
      }),
      makeEntry({ id: "empty", synced_at: "2026-08-25T10:00:00.000Z" })
    );

    const merged = await reconcileJournalDuplicatesForDate("2026-08-25");

    expect(merged?.id).toBe("filled");
    expect(merged?.text_content).toBe("Real writing");
    expect(journalEntries.find((e) => e.id === "empty")?.deleted_at).toBe(
      "2026-08-26T10:00:00.000Z"
    );
  });

  it("refuses to tombstone a duplicate whose content did not survive the merge", async () => {
    // Two emoji cannot be merged into one field, so the loser still holds something
    // the winner does not. Production has 54 machine-written journal tombstones, 53
    // with text: this is the guard that stops the 55th.
    journalEntries.push(
      makeEntry({
        id: "winner",
        day_emoji: "🌞",
        text_content: "Sunny notes",
        synced_at: "2026-08-25T10:00:00.000Z",
      }),
      makeEntry({
        id: "loser",
        day_emoji: "🌧️",
        synced_at: "2026-08-25T10:00:00.000Z",
      })
    );

    await reconcileJournalDuplicatesForDate("2026-08-25");

    const loser = journalEntries.find((e) => e.id === "loser");
    expect(loser?.deleted_at).toBeNull();
    // And the unresolved duplicate is reviewable rather than silent.
    expect(recordedIssues.some((i) => i.kind === "conflict")).toBe(true);
  });

  it("does not re-raise a conflict card for an already-flagged day", async () => {
    // reconcileAllJournalDuplicates runs after every sync.
    journalEntries.push(
      makeEntry({
        id: "winner",
        day_emoji: "🌞",
        text_content: "Sunny notes",
        synced_at: "2026-08-25T10:00:00.000Z",
      }),
      makeEntry({
        id: "loser",
        day_emoji: "🌧️",
        synced_at: "2026-08-25T10:00:00.000Z",
      })
    );
    // The card is keyed on the surviving row, which the richness score puts first.
    openConflictIds = new Set(["winner"]);

    await reconcileJournalDuplicatesForDate("2026-08-25");

    expect(recordedIssues).toHaveLength(0);
  });

  it("discards the loser's queued ops instead of hard-deleting them", async () => {
    // This was a bulkDelete(), the only place in the app that erases pending op rows
    // rather than marking them `discarded`. It destroyed the record of a write that
    // had not reached the server.
    journalEntries.push(
      makeEntry({
        id: "winner",
        text_content: "Kept",
        synced_at: "2026-08-25T10:00:00.000Z",
      }),
      makeEntry({ id: "loser", synced_at: "2026-08-25T10:00:00.000Z" })
    );
    const pendingOp = makeOp("loser", "pending");
    const failedOp = makeOp("loser", "failed");

    await reconcileJournalDuplicatesForDate("2026-08-25");

    expect(discarded).toContain(pendingOp.id);
    // A rejected op for the loser is the case most likely to hold the only copy.
    expect(discarded).toContain(failedOp.id);
    expect(pendingOps).toHaveLength(2);
  });

  it("leaves the winner's own queued ops alone", async () => {
    journalEntries.push(
      makeEntry({
        id: "winner",
        text_content: "Kept",
        synced_at: "2026-08-25T10:00:00.000Z",
      }),
      makeEntry({ id: "loser", synced_at: "2026-08-25T10:00:00.000Z" })
    );
    const winnerOp = makeOp("winner", "pending");

    await reconcileJournalDuplicatesForDate("2026-08-25");

    expect(discarded).not.toContain(winnerOp.id);
  });

  it("is a no-op for a day with a single entry", async () => {
    journalEntries.push(makeEntry({ id: "only", text_content: "Solo" }));

    const merged = await reconcileJournalDuplicatesForDate("2026-08-25");

    expect(merged?.id).toBe("only");
    expect(journalEntries).toHaveLength(1);
  });
});
