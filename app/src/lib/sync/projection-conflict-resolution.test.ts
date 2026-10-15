import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "99999999-9999-4999-8999-999999999999" as string | null,
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
import type { Activity, Memory, SyncIssue } from "@/lib/db/types";
import {
  buildProjectionConflictPayload,
  isProjectionConflictPayload,
  refreshProjectionConflictPayload,
  resolveProjectionConflict,
  type ProjectionConflictPayload,
} from "./projection-conflict-resolution";

const LOCAL_AT = "2026-08-01T09:00:00.000Z";
const REMOTE_AT = "2026-08-01T11:00:00.000Z";

function activity(over: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    group_id: "g1",
    name: "Morning run",
    routine: "daily",
    completion_target: 1,
    archived_at: null,
    tracks_time: true,
    is_pinned: false,
    order_index: 0,
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: LOCAL_AT,
    synced_at: null,
    deleted_at: null,
    ...over,
  };
}

function memory(over: Partial<Memory> = {}): Memory {
  return {
    id: "mem-1",
    text_content: "Learning to swim",
    photo_paths: null,
    time_label: "when I was six",
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: LOCAL_AT,
    synced_at: null,
    deleted_at: null,
    ...over,
  };
}

async function openActivityConflict(
  local: Partial<Activity>,
  remote: Partial<Activity>
): Promise<{ issue: SyncIssue; payload: ProjectionConflictPayload }> {
  await db.activities.put(activity(local));
  const payload = await buildProjectionConflictPayload({
    entity_type: "activity",
    entity_id: "act-1",
    localRow: activity(local) as unknown as Record<string, unknown>,
    remoteRow: activity({
      updated_at: REMOTE_AT,
      ...remote,
    }) as unknown as Record<string, unknown>,
    remoteDeviceId: "device-remote",
  });
  const issue: SyncIssue = {
    id: "issue-1",
    kind: "conflict",
    status: "open",
    account_id: auth.userId,
    title: "Activity conflict",
    detail: null,
    entity_type: "activity",
    entity_id: "act-1",
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
    db.activities.clear(),
    db.memories.clear(),
    db.journalEntryRevisions.clear(),
    db.syncPendingOperations.clear(),
    db.syncIssues.clear(),
  ]);
});

describe("isProjectionConflictPayload", () => {
  it("detects projection conflict payloads", () => {
    expect(isProjectionConflictPayload({ kind: "projection_conflict" })).toBe(
      true
    );
    expect(isProjectionConflictPayload({ kind: "journal_conflict" })).toBe(
      false
    );
    expect(isProjectionConflictPayload(undefined)).toBe(false);
  });
});

describe("buildProjectionConflictPayload", () => {
  it("lists only the fields that differ, and labels the item by its name", async () => {
    const { payload } = await openActivityConflict(
      { name: "Run", completion_target: 2 },
      { name: "Jog", completion_target: 2, routine: "weekly" }
    );
    expect(payload.entity_label).toBe("Run");
    expect(payload.differing_fields).toEqual(["name", "routine"]);
  });
});

describe("resolveProjectionConflict", () => {
  it("keep this device's: writes the whole local version on the other side's revision", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run", routine: "daily" },
      { name: "Jog", routine: "weekly" }
    );

    await resolveProjectionConflict(issue, "keep_local");

    expect(await db.activities.get("act-1")).toMatchObject({
      name: "Run",
      routine: "daily",
    });
    const [op] = await ops("activity");
    expect(op).toMatchObject({
      entity_id: "act-1",
      operation_type: "projection.upsert",
      base_revision: REMOTE_AT,
    });
  });

  it("keep the other: writes the whole other version, every field of it", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run", routine: "daily", is_pinned: false },
      { name: "Jog", routine: "weekly", is_pinned: true }
    );

    await resolveProjectionConflict(issue, "keep_remote");

    // No field is picked over from this device: it is one whole version.
    expect(await db.activities.get("act-1")).toMatchObject({
      name: "Jog",
      routine: "weekly",
      is_pinned: true,
    });
  });

  it("never mixes the two versions field by field", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run", completion_target: 3 },
      { name: "Jog", completion_target: 1 }
    );
    await resolveProjectionConflict(issue, "keep_remote");
    const row = await db.activities.get("act-1");
    expect([row?.name, row?.completion_target]).toEqual(["Jog", 1]);
  });

  it("does not touch previous versions: they are for journal days only", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run" },
      { name: "Jog" }
    );
    await resolveProjectionConflict(issue, "keep_remote");
    expect(await db.journalEntryRevisions.count()).toBe(0);
    expect(await ops("journal_entry_revision")).toHaveLength(0);
  });

  it("marks the issue resolved with the choice", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run" },
      { name: "Jog" }
    );

    await resolveProjectionConflict(issue, "keep_remote");

    const stored = await db.syncIssues.get(issue.id);
    expect(stored?.status).toBe("resolved");
    expect(
      (stored?.payload as ProjectionConflictPayload).resolution?.choice
    ).toBe("keep_remote");
  });

  it("writes the choice once, however many times it is asked for", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run" },
      { name: "Jog" }
    );
    await resolveProjectionConflict(issue, "keep_local");
    await resolveProjectionConflict(issue, "keep_remote");
    expect((await db.activities.get("act-1"))?.name).toBe("Run");
    expect(await ops("activity")).toHaveLength(1);
  });

  it("resolves a memo the same way", async () => {
    await db.memories.put(memory({ text_content: "Mine" }));
    const payload = await buildProjectionConflictPayload({
      entity_type: "memory",
      entity_id: "mem-1",
      localRow: memory({ text_content: "Mine" }) as unknown as Record<
        string,
        unknown
      >,
      remoteRow: memory({
        text_content: "Theirs",
        updated_at: REMOTE_AT,
      }) as unknown as Record<string, unknown>,
    });
    const issue: SyncIssue = {
      id: "issue-m",
      kind: "conflict",
      status: "open",
      account_id: auth.userId,
      title: "Memory conflict",
      detail: null,
      entity_type: "memory",
      entity_id: "mem-1",
      operation_id: null,
      payload,
      created_at: "2026-08-02T10:00:00.000Z",
      updated_at: "2026-08-02T10:00:00.000Z",
      resolved_at: null,
    };
    await db.syncIssues.put(issue);

    await resolveProjectionConflict(issue, "keep_remote");

    expect((await db.memories.get("mem-1"))?.text_content).toBe("Theirs");
    expect(await ops("memory")).toHaveLength(1);
  });

  it("refuses to keep the other version when there is none, and changes nothing", async () => {
    const { issue, payload } = await openActivityConflict(
      { name: "Run" },
      { name: "Jog" }
    );
    const withoutRemote = { ...issue, payload: { ...payload, remote: null } };

    await expect(
      resolveProjectionConflict(withoutRemote, "keep_remote")
    ).rejects.toThrow(/unavailable/i);

    expect((await db.activities.get("act-1"))?.name).toBe("Run");
    expect(await ops("activity")).toHaveLength(0);
    expect((await db.syncIssues.get(issue.id))?.status).toBe("open");
  });

  it("fails clearly when the item is no longer on this device", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run" },
      { name: "Jog" }
    );
    await db.activities.clear();
    await expect(
      resolveProjectionConflict(issue, "keep_local")
    ).rejects.toThrow(/no longer on this device/i);
  });
});

describe("refreshProjectionConflictPayload", () => {
  it("keeps the other version captured with the conflict when it cannot be fetched again", async () => {
    // Offline, or the server row is out of reach: `supabase` is null here.
    const { payload } = await openActivityConflict(
      { name: "Run" },
      { name: "Jog" }
    );

    const refreshed = await refreshProjectionConflictPayload(payload);

    expect(refreshed.remote?.fields.name).toBe("Jog");
    expect(refreshed.remote?.updated_at).toBe(REMOTE_AT);
    expect(refreshed.differing_fields).toContain("name");
  });

  it("lets the other version still be kept after a refresh that could not fetch", async () => {
    const { issue } = await openActivityConflict(
      { name: "Run" },
      { name: "Jog" }
    );
    await resolveProjectionConflict(issue, "keep_remote");
    expect((await db.activities.get("act-1"))?.name).toBe("Jog");
  });
});
