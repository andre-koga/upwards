import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry, SyncIssue } from "@/lib/db/types";

const { enqueueProjectionMock } = vi.hoisted(() => ({
  enqueueProjectionMock: vi.fn(async () => undefined),
}));

const journalEntries = new Map<string, JournalEntry>();
const syncIssues: SyncIssue[] = [];

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  },
  getCachedUserId: () => "user-1",
}));

vi.mock("@/lib/sync/projection-sync", () => ({
  withSuppressedProjectionEnqueue: async (operation: () => Promise<unknown>) =>
    operation(),
  enqueueProjectionUpsertForTable: enqueueProjectionMock,
}));

vi.mock("@/lib/db", () => ({
  now: () => "2026-08-02T12:00:00.000Z",
  db: {
    journalEntries: {
      get: async (id: string) => journalEntries.get(id),
      put: async (row: JournalEntry) => {
        journalEntries.set(row.id, row);
      },
    },
    syncIssues: {
      update: async (id: string, patch: Partial<SyncIssue>) => {
        const index = syncIssues.findIndex((issue) => issue.id === id);
        if (index >= 0) {
          syncIssues[index] = { ...syncIssues[index], ...patch };
        }
      },
    },
  },
}));

vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-local",
}));

import {
  buildJournalConflictPayload,
  formatJournalConflictFieldValue,
  isJournalConflictPayload,
  resolveJournalConflict,
} from "@/lib/sync/journal-conflict-resolution";

const journalId = "journal-1";

function makeJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: journalId,
    entry_date: "2026-08-01",
    title: "Morning thoughts",
    text_content: "Local journal text",
    day_emoji: "☀️",
    is_bookmarked: false,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    is_journal_complete: false,
    journal_entry_number: 1,
    journal_completion_streak: null,
    journal_completed_at: null,
    location: null,
    created_at: "2026-08-01T08:00:00.000Z",
    updated_at: "2026-08-01T09:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function makeIssue(payload: unknown): SyncIssue {
  return {
    id: "issue-1",
    kind: "conflict",
    status: "open",
    account_id: "user-1",
    title: "Journal entry conflict",
    detail: null,
    entity_type: "journal_entry",
    entity_id: journalId,
    operation_id: "op-1",
    payload,
    created_at: "2026-08-02T10:00:00.000Z",
    updated_at: "2026-08-02T10:00:00.000Z",
    resolved_at: null,
  };
}

describe("isJournalConflictPayload", () => {
  it("detects journal conflict payloads", () => {
    expect(isJournalConflictPayload({ kind: "journal_conflict" })).toBe(true);
    expect(isJournalConflictPayload({ kind: "definition_conflict" })).toBe(
      false
    );
    expect(isJournalConflictPayload(null)).toBe(false);
  });
});

describe("buildJournalConflictPayload", () => {
  beforeEach(() => {
    journalEntries.clear();
    enqueueProjectionMock.mockClear();
  });

  it("builds a diff between local and remote rows", async () => {
    journalEntries.set(journalId, makeJournal());

    const payload = await buildJournalConflictPayload({
      entity_id: journalId,
      localRow: makeJournal({ text_content: "My newer text" }),
      remoteRow: makeJournal({
        text_content: "Their text",
        title: "Their title",
        updated_at: "2026-08-01T10:00:00.000Z",
      }),
      remoteDeviceId: "device-remote",
    });

    expect(payload.kind).toBe("journal_conflict");
    expect(payload.entity_label).toBe("Morning thoughts");
    expect(payload.differing_fields).toContain("text_content");
    expect(payload.differing_fields).toContain("title");
    expect(payload.remote?.device_id).toBe("device-remote");
  });
});

describe("formatJournalConflictFieldValue", () => {
  it("truncates long journal text", () => {
    const longText = "a".repeat(150);
    const formatted = formatJournalConflictFieldValue("text_content", longText);
    expect(formatted.endsWith("…")).toBe(true);
    expect(formatted.length).toBeLessThan(longText.length);
  });

  it("summarizes photo paths", () => {
    expect(formatJournalConflictFieldValue("photo_paths", ["a", "b"])).toBe(
      "2 photos"
    );
  });
});

describe("resolveJournalConflict", () => {
  beforeEach(() => {
    journalEntries.clear();
    syncIssues.length = 0;
    enqueueProjectionMock.mockClear();
    journalEntries.set(journalId, makeJournal());
  });

  it("keeps remote fields and enqueues a projection upsert", async () => {
    const payload = await buildJournalConflictPayload({
      entity_id: journalId,
      localRow: makeJournal({ text_content: "Local text" }),
      remoteRow: makeJournal({
        text_content: "Remote text",
        title: "Remote title",
        updated_at: "2026-08-01T11:00:00.000Z",
      }),
    });
    const issue = makeIssue(payload);
    syncIssues.push(issue);

    await resolveJournalConflict(issue, "keep_remote");

    const updated = journalEntries.get(journalId);
    expect(updated?.text_content).toBe("Remote text");
    expect(updated?.title).toBe("Remote title");
    expect(enqueueProjectionMock).toHaveBeenCalledWith(
      "journal_entries",
      expect.objectContaining({
        id: journalId,
        text_content: "Remote text",
      }),
      "2026-08-01T11:00:00.000Z"
    );
    expect(syncIssues[0].status).toBe("resolved");
  });

  it("keeps local fields and enqueues a projection upsert", async () => {
    const payload = await buildJournalConflictPayload({
      entity_id: journalId,
      localRow: makeJournal({
        text_content: "Local text",
        day_emoji: "🌙",
      }),
      remoteRow: makeJournal({
        text_content: "Remote text",
        title: "Remote title",
        updated_at: "2026-08-01T11:00:00.000Z",
      }),
    });
    const issue = makeIssue(payload);
    syncIssues.push(issue);

    await resolveJournalConflict(issue, "keep_local");

    const updated = journalEntries.get(journalId);
    expect(updated?.text_content).toBe("Local text");
    expect(updated?.day_emoji).toBe("🌙");
    expect(enqueueProjectionMock).toHaveBeenCalledWith(
      "journal_entries",
      expect.objectContaining({
        id: journalId,
        text_content: "Local text",
      }),
      "2026-08-01T11:00:00.000Z"
    );
    expect(syncIssues[0].status).toBe("resolved");
  });
});
