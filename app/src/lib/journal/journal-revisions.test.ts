import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "66666666-6666-4666-8666-666666666666" as string | null,
  deviceId: "device-a",
  deleted: [] as string[],
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
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => auth.deviceId,
}));
vi.mock("@/lib/sync/sync-scheduler", () => ({
  requestDebouncedSync: () => undefined,
}));
vi.mock("@/lib/journal/photo-storage", () => ({
  deleteJournalPhoto: async (path: string) => {
    auth.deleted.push(path);
  },
}));

import { db } from "@/lib/db";
import type { JournalEntryRevision } from "@/lib/db/types";
import { applyAcceptedProjectionOp } from "@/lib/sync/projection-sync";
import { recordJournalRevision } from "@/lib/sync/mutate-synced";
import type { RemoteSyncOperation } from "@/lib/sync/sync-operations";
import { emptyBackupTables } from "@/lib/backup/format";
import { importBackup } from "@/lib/sync/mutate-synced";
import { collectPhotoRefs } from "@/lib/backup/media";
import { deletePhotosNoLongerUsed } from "./photo-cleanup";

const T = "2026-10-05T12:00:00.000Z";

function revision(
  id: string,
  patch: Partial<JournalEntryRevision> = {}
): JournalEntryRevision {
  return {
    id,
    entry_date: "2025-03-14",
    title: "Before",
    day_emoji: "🙂",
    text_content: "The old text",
    photo_paths: ["u/old.jpg"],
    video_path: null,
    video_thumbnail: null,
    created_at: T,
    updated_at: T,
    synced_at: null,
    ...patch,
  };
}

async function pendingRevisionOps() {
  return (await db.syncPendingOperations.toArray()).filter(
    (op) => op.entity_type === "journal_entry_revision"
  );
}

/** What the server would hand to another device for a pending op. */
function asRemoteOp(
  op: Awaited<ReturnType<typeof pendingRevisionOps>>[number],
  sequence: number
): RemoteSyncOperation {
  return {
    operation_id: op.operation_id,
    device_id: op.device_id,
    entity_type: op.entity_type,
    entity_id: op.entity_id,
    operation_type: op.operation_type,
    payload: op.payload as Record<string, unknown>,
    base_revision: op.base_revision ?? null,
    status: "accepted",
    server_sequence: sequence,
    created_at: T,
  } as RemoteSyncOperation;
}

beforeEach(async () => {
  storage.clear();
  auth.deleted = [];
  auth.deviceId = "device-a";
  await Promise.all([
    db.journalEntryRevisions.clear(),
    db.syncPendingOperations.clear(),
    db.syncIssues.clear(),
  ]);
});

describe("recordJournalRevision", () => {
  it("stores the revision and queues exactly one append-only op", async () => {
    await recordJournalRevision(revision("r1"));

    expect(await db.journalEntryRevisions.get("r1")).toMatchObject({
      title: "Before",
      text_content: "The old text",
    });
    const ops = await pendingRevisionOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      entity_id: "r1",
      operation_type: "projection.upsert",
      base_revision: null,
    });
  });

  it("is a no-op when the same revision is recorded again", async () => {
    await recordJournalRevision(revision("r1"));
    await recordJournalRevision(revision("r1", { text_content: "Changed" }));

    expect((await db.journalEntryRevisions.get("r1"))?.text_content).toBe(
      "The old text"
    );
    expect(await pendingRevisionOps()).toHaveLength(1);
  });
});

describe("two devices", () => {
  it("each append one revision and both end up with both", async () => {
    // Device A records r1.
    auth.deviceId = "device-a";
    await recordJournalRevision(revision("r1", { title: "From A" }));
    const opFromA = asRemoteOp((await pendingRevisionOps())[0], 1);

    // Device B starts with its own empty store and receives A's op.
    await Promise.all([
      db.journalEntryRevisions.clear(),
      db.syncPendingOperations.clear(),
    ]);
    auth.deviceId = "device-b";
    expect(await applyAcceptedProjectionOp(opFromA)).toBe(true);
    expect((await db.journalEntryRevisions.get("r1"))?.title).toBe("From A");

    // B records its own, then A receives it.
    await recordJournalRevision(revision("r2", { title: "From B" }));
    const opFromB = asRemoteOp(
      (await pendingRevisionOps()).find((op) => op.entity_id === "r2")!,
      2
    );
    expect((await db.journalEntryRevisions.toArray()).map((r) => r.id)).toEqual(
      expect.arrayContaining(["r1", "r2"])
    );

    await db.journalEntryRevisions.clear();
    await db.journalEntryRevisions.add(revision("r1", { title: "From A" }));
    await db.syncPendingOperations.clear();
    auth.deviceId = "device-a";
    await applyAcceptedProjectionOp(opFromB);

    const onA = await db.journalEntryRevisions.toArray();
    expect(onA.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    // Receiving a remote revision must not queue it again.
    expect(await pendingRevisionOps()).toHaveLength(0);
  });

  it("applying the same remote revision twice stores one row", async () => {
    await recordJournalRevision(revision("r1"));
    const remote = asRemoteOp((await pendingRevisionOps())[0], 1);
    await db.syncPendingOperations.clear();

    await applyAcceptedProjectionOp(remote);
    await applyAcceptedProjectionOp(remote);
    expect(await db.journalEntryRevisions.count()).toBe(1);
  });
});

describe("backup", () => {
  it("restores revisions once and never duplicates them", async () => {
    const tables = emptyBackupTables();
    tables.journalEntryRevisions = [revision("r1"), revision("r2")];
    const options = {
      targetUserKey: auth.userId!,
      syncedSequence: 0,
    };

    await importBackup(tables, options);
    await importBackup(tables, options);

    expect(await db.journalEntryRevisions.count()).toBe(2);
    expect(await pendingRevisionOps()).toHaveLength(2);
  });

  it("includes revision photos among the media to back up", () => {
    const tables = emptyBackupTables();
    tables.journalEntryRevisions = [
      revision("r1", { photo_paths: ["u/only-in-revision.jpg"] }),
    ];
    expect(collectPhotoRefs(tables).map((ref) => ref.path)).toContain(
      "u/only-in-revision.jpg"
    );
  });
});

describe("deletePhotosNoLongerUsed", () => {
  it("skips photos a revision still references and deletes the rest", async () => {
    await recordJournalRevision(
      revision("r1", { photo_paths: ["u/kept.jpg"] })
    );

    await deletePhotosNoLongerUsed(["u/kept.jpg", "u/gone.jpg"]);

    expect(auth.deleted).toEqual(["u/gone.jpg"]);
  });

  it("does nothing for an empty list", async () => {
    await deletePhotosNoLongerUsed([]);
    expect(auth.deleted).toEqual([]);
  });
});
