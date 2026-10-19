import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "88888888-8888-4888-8888-888888888888" as string | null,
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => auth.userId,
  getQueueAccountId: () => auth.userId,
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-local",
}));
vi.mock("@/lib/sync/sync-scheduler", () => ({
  requestDebouncedSync: () => undefined,
}));

import { db } from "@/lib/db";
import type { JournalEntry, LocationData, SyncIssue } from "@/lib/db/types";
import { KEEP_BOTH_DIVIDER } from "@/lib/journal/keep-both";
import { naturalJournalIdForDate } from "@/lib/sync/natural-ids";
import {
  buildJournalConflictPayload,
  isJournalConflictPayload,
  resolveJournalConflict,
  type JournalConflictPayload,
} from "./journal-conflict-resolution";

const DATE = "2026-08-01";
const ID = naturalJournalIdForDate(DATE);
const LOCAL_AT = "2026-08-01T09:00:00.000Z";
const REMOTE_AT = "2026-08-01T11:00:00.000Z";

const place = (name: string): LocationData => ({
  displayName: name,
  city: name,
  state: null,
  country: null,
  countryCode: null,
  lat: null,
  lon: null,
});

function journal(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: ID,
    entry_date: DATE,
    title: "Morning",
    text_content: "Local words",
    day_emoji: "☀️",
    is_bookmarked: false,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    location: null,
    created_at: "2026-08-01T08:00:00.000Z",
    updated_at: LOCAL_AT,
    synced_at: null,
    deleted_at: null,
    ...over,
  };
}

async function openConflict(
  local: Partial<JournalEntry>,
  remote: Partial<JournalEntry>,
  options: { source?: "backup" } = {}
): Promise<{ issue: SyncIssue; payload: JournalConflictPayload }> {
  await db.journalEntries.put(journal(local));
  const built = await buildJournalConflictPayload({
    entity_id: ID,
    localRow: journal(local),
    remoteRow: journal({ updated_at: REMOTE_AT, ...remote }),
    remoteDeviceId: "device-remote",
  });
  const payload: JournalConflictPayload = { ...built, ...options };
  const issue: SyncIssue = {
    id: "issue-1",
    kind: "conflict",
    status: "open",
    account_id: auth.userId,
    title: "Journal conflict",
    detail: null,
    entity_type: "journal_entry",
    entity_id: ID,
    operation_id: "op-1",
    payload,
    created_at: "2026-08-02T10:00:00.000Z",
    updated_at: "2026-08-02T10:00:00.000Z",
    resolved_at: null,
  };
  await db.syncIssues.put(issue);
  return { issue, payload };
}

async function ops(entityType: string) {
  return (await db.syncPendingOperations.toArray()).filter(
    (op) => op.entity_type === entityType
  );
}

beforeEach(async () => {
  storage.clear();
  await Promise.all([
    db.journalEntries.clear(),
    db.journalEntryRevisions.clear(),
    db.syncPendingOperations.clear(),
    db.syncIssues.clear(),
  ]);
});

describe("isJournalConflictPayload", () => {
  it("detects journal conflict payloads", () => {
    expect(isJournalConflictPayload({ kind: "journal_conflict" })).toBe(true);
    expect(isJournalConflictPayload({ kind: "projection_conflict" })).toBe(
      false
    );
    expect(isJournalConflictPayload(null)).toBe(false);
  });
});

describe("buildJournalConflictPayload", () => {
  it("lists the fields that differ and labels the entry", async () => {
    const { payload } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs", title: "Theirs title" }
    );
    expect(payload.kind).toBe("journal_conflict");
    expect(payload.entity_label).toBe("Morning");
    expect(payload.differing_fields).toEqual(
      expect.arrayContaining(["text_content", "title"])
    );
    expect(payload.differing_fields).not.toContain("day_emoji");
    expect(payload.remote?.device_id).toBe("device-remote");
  });
});

describe("resolveJournalConflict", () => {
  it("keep mine: writes this device's day on the other side's revision", async () => {
    const { issue } = await openConflict(
      { text_content: "Mine", day_emoji: "🌙" },
      { text_content: "Theirs", title: "Theirs title" }
    );

    await resolveJournalConflict(issue, "keep_local");

    const row = await db.journalEntries.get(ID);
    expect(row).toMatchObject({
      text_content: "Mine",
      title: "Morning",
      day_emoji: "🌙",
    });
    expect(row?.updated_at).not.toBe(LOCAL_AT);

    const [op] = await ops("journal_entry");
    expect(op).toMatchObject({
      entity_id: ID,
      operation_type: "projection.upsert",
      base_revision: REMOTE_AT,
    });
    expect((op.payload as { row: JournalEntry }).row.text_content).toBe("Mine");
  });

  it("keep theirs: writes the other device's day", async () => {
    const { issue } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs", title: "Theirs title" }
    );

    await resolveJournalConflict(issue, "keep_remote");

    expect(await db.journalEntries.get(ID)).toMatchObject({
      text_content: "Theirs",
      title: "Theirs title",
    });
    const [op] = await ops("journal_entry");
    expect(op.base_revision).toBe(REMOTE_AT);
  });

  it("keeps the side it leaves out as a previous version, so no choice is final", async () => {
    const { issue } = await openConflict(
      { text_content: "My careful words" },
      { text_content: "Their careful words" }
    );

    await resolveJournalConflict(issue, "keep_local");

    const [revision] = await db.journalEntryRevisions.toArray();
    expect(revision).toMatchObject({
      entry_date: DATE,
      text_content: "Their careful words",
    });
    // And it syncs, like any revision.
    expect(await ops("journal_entry_revision")).toHaveLength(1);
  });

  it("keeps this device's words as a previous version when theirs are chosen", async () => {
    const { issue } = await openConflict(
      { text_content: "My careful words", photo_paths: ["u/mine.jpg"] },
      { text_content: "Their careful words" }
    );

    await resolveJournalConflict(issue, "keep_remote");

    const [revision] = await db.journalEntryRevisions.toArray();
    expect(revision).toMatchObject({
      text_content: "My careful words",
      photo_paths: ["u/mine.jpg"],
    });
  });

  it("keep both: joins the texts, unions photos and places, and keeps a heart", async () => {
    const { issue } = await openConflict(
      {
        text_content: "Walked to the lake.",
        photo_paths: ["u/a.jpg"],
        location: { locations: [place("Lisbon")] },
      },
      {
        text_content: "Cooked dinner.",
        photo_paths: ["u/a.jpg", "u/b.jpg"],
        location: { locations: [place("Porto")] },
        is_bookmarked: true,
      }
    );

    await resolveJournalConflict(issue, "keep_both");

    const row = await db.journalEntries.get(ID);
    expect(row?.text_content).toBe(
      `Walked to the lake.${KEEP_BOTH_DIVIDER}Cooked dinner.`
    );
    expect(row?.photo_paths).toEqual(["u/a.jpg", "u/b.jpg"]);
    expect(row?.location?.locations.map((l) => l.displayName)).toEqual([
      "Lisbon",
      "Porto",
    ]);
    expect(row?.is_bookmarked).toBe(true);
    const [op] = await ops("journal_entry");
    expect(op.base_revision).toBe(REMOTE_AT);
  });

  it("keep both leaves nothing out, so it records no previous version", async () => {
    const { issue } = await openConflict(
      { text_content: "A" },
      { text_content: "B" }
    );
    await resolveJournalConflict(issue, "keep_both");
    expect(await db.journalEntryRevisions.count()).toBe(0);
  });

  it("marks the issue resolved with the choice and the resulting revision", async () => {
    const { issue } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs" }
    );

    await resolveJournalConflict(issue, "keep_remote");

    const stored = await db.syncIssues.get(issue.id);
    expect(stored?.status).toBe("resolved");
    expect(stored?.resolved_at).toBeTruthy();
    const resolution = (stored?.payload as JournalConflictPayload).resolution;
    expect(resolution?.choice).toBe("keep_remote");
    expect(resolution?.resulting_updated_at).toBe(
      (await db.journalEntries.get(ID))?.updated_at
    );
  });

  it("does nothing a second time: a double tap writes one edit", async () => {
    const { issue } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs" }
    );

    await resolveJournalConflict(issue, "keep_local");
    await resolveJournalConflict(issue, "keep_remote");

    expect((await db.journalEntries.get(ID))?.text_content).toBe("Mine");
    expect(await ops("journal_entry")).toHaveLength(1);
  });

  it("refuses to keep the other side when it is unavailable, and changes nothing", async () => {
    const { issue, payload } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs" }
    );
    await db.syncIssues.update(issue.id, {
      payload: { ...payload, remote: null },
    });
    const withoutRemote = { ...issue, payload: { ...payload, remote: null } };

    await expect(
      resolveJournalConflict(withoutRemote, "keep_remote")
    ).rejects.toThrow(/unavailable/i);
    await expect(
      resolveJournalConflict(withoutRemote, "keep_both")
    ).rejects.toThrow(/unavailable/i);

    expect((await db.journalEntries.get(ID))?.text_content).toBe("Mine");
    expect(await ops("journal_entry")).toHaveLength(0);
    expect((await db.syncIssues.get(issue.id))?.status).toBe("open");
  });

  it("still lets this device's version be kept when the other is unavailable", async () => {
    const { issue, payload } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs" }
    );
    const withoutRemote = { ...issue, payload: { ...payload, remote: null } };

    await resolveJournalConflict(withoutRemote, "keep_local");

    expect((await db.journalEntries.get(ID))?.text_content).toBe("Mine");
    expect((await db.syncIssues.get(issue.id))?.status).toBe("resolved");
  });

  it("makes a backup's resolution on the revision this device last synced, never on none", async () => {
    const { issue } = await openConflict(
      { text_content: "Mine" },
      { text_content: "From the backup" },
      { source: "backup" }
    );

    await resolveJournalConflict(issue, "keep_remote");

    const [op] = await ops("journal_entry");
    // The backup's own revision was never on the server. With no base the edit
    // would be a blind overwrite, so the row this device holds is the base.
    expect(op.base_revision).toBe(LOCAL_AT);
    expect((await db.journalEntries.get(ID))?.text_content).toBe(
      "From the backup"
    );
  });

  it("never changes the date or id of the day", async () => {
    const { issue } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs", entry_date: "2099-01-01" }
    );

    await resolveJournalConflict(issue, "keep_remote");

    const row = await db.journalEntries.get(ID);
    expect(row?.entry_date).toBe(DATE);
    expect(row?.id).toBe(ID);
  });

  it("fails clearly when the day is no longer on this device", async () => {
    const { issue } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs" }
    );
    await db.journalEntries.clear();

    await expect(resolveJournalConflict(issue, "keep_local")).rejects.toThrow(
      /no longer on this device/i
    );
    expect((await db.syncIssues.get(issue.id))?.status).toBe("open");
  });

  it("can resolve a conflict recorded before keep-both existed (extra fields are ignored)", async () => {
    const { issue, payload } = await openConflict(
      { text_content: "Mine" },
      { text_content: "Theirs" }
    );
    const legacy = {
      ...issue,
      payload: {
        ...payload,
        auto_combinable_fields: ["title"],
        both_changed_fields: ["text_content"],
      },
    };

    await resolveJournalConflict(legacy, "keep_remote");

    expect((await db.journalEntries.get(ID))?.text_content).toBe("Theirs");
  });
});
