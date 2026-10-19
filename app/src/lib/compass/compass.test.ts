import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "66666666-6666-4666-8666-666666666666" as string | null,
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
  getOrCreateDeviceId: () => "device-a",
}));
vi.mock("@/lib/sync", () => ({
  syncEngine: {
    getState: () => ({ updateRequired: false, lastError: null }),
    sync: async () => undefined,
    subscribe: () => () => undefined,
  },
}));

import { db } from "@/lib/db";
import type { CompassItem } from "@/lib/db/types";
import { naturalNorthStarId } from "@/lib/sync/natural-ids";
import { getLocalSyncSafetyStatus } from "@/lib/sync/unsynced-data";
import {
  COMPASS_LIMITS,
  CompassError,
  addGoal,
  addIdentityWord,
  addKnowledge,
  archiveCompassItem,
  deleteCompassItem,
  editCompassItem,
  groupCompassItems,
  normalizeCompassText,
  northStarId,
  restoreCompassItem,
  setNorthStar,
} from "./compass";

const USER = "66666666-6666-4666-8666-666666666666";
const OTHER = "77777777-7777-4777-8777-777777777777";

function item(patch: Partial<CompassItem>): CompassItem {
  return {
    id: crypto.randomUUID(),
    kind: "goal",
    text: "A goal",
    question: null,
    activity_id: null,
    group_id: null,
    created_at: "2026-10-19T10:00:00.000Z",
    updated_at: "2026-10-19T10:00:00.000Z",
    synced_at: null,
    archived_at: null,
    deleted_at: null,
    ...patch,
  };
}

async function queue() {
  return (
    await db.syncPendingOperations.orderBy("created_at").toArray()
  ).filter((op) => op.entity_type === "compass_item");
}

beforeEach(async () => {
  auth.userId = USER;
  await db.compassItems.clear();
  await db.syncPendingOperations.clear();
});

describe("normalizeCompassText", () => {
  it("trims and collapses the whitespace of the short kinds", () => {
    expect(normalizeCompassText("goal", "  read   more \n before bed ")).toBe(
      "read more before bed"
    );
  });

  it("keeps the line breaks of a knowledge answer", () => {
    expect(normalizeCompassText("knowledge", " one\n\ntwo ")).toBe(
      "one\n\ntwo"
    );
  });

  it("rejects empty text", () => {
    expect(() => normalizeCompassText("goal", "  \n ")).toThrow(CompassError);
  });

  it("accepts text at the limit and rejects one over, per kind", () => {
    for (const kind of [
      "north_star",
      "identity",
      "goal",
      "knowledge",
    ] as const) {
      const limit = COMPASS_LIMITS[kind];
      expect(normalizeCompassText(kind, "x".repeat(limit))).toHaveLength(limit);
      expect(() => normalizeCompassText(kind, "x".repeat(limit + 1))).toThrow(
        expect.objectContaining({ code: "too_long" })
      );
    }
  });
});

describe("the north star", () => {
  it("is one row, with an id every device computes", async () => {
    const first = await setNorthStar("Someone who finishes what they start");
    expect(first.id).toBe(naturalNorthStarId(USER));
    expect(northStarId()).toBe(first.id);

    await setNorthStar("Someone who rests without guilt");
    const rows = await db.compassItems.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe("Someone who rests without guilt");
  });

  it("takes a different id for a different person", () => {
    expect(naturalNorthStarId(USER)).not.toBe(naturalNorthStarId(OTHER));
  });

  it("queues a create with no base, then an edit based on the version it replaced", async () => {
    const created = await setNorthStar("First");
    await setNorthStar("Second");
    const ops = await queue();
    expect(ops).toHaveLength(2);
    expect(ops[0].operation_type).toBe("projection.upsert");
    expect(ops[0].base_revision).toBeNull();
    expect(ops[1].base_revision).toBe(created.updated_at);
  });

  it("is brought back by writing it again after it was set aside or deleted", async () => {
    const star = await setNorthStar("First");
    await deleteCompassItem(star.id);
    await setNorthStar("Again");
    const back = await db.compassItems.get(star.id);
    expect(back).toMatchObject({ text: "Again", deleted_at: null });
  });
});

describe("the other kinds merge by union", () => {
  it("gives every identity word, goal and answer its own row", async () => {
    await addIdentityWord("Patient");
    await addIdentityWord("Patient");
    await addGoal("Finish the studio refresh");
    await addKnowledge(
      "Coffee and a quiet morning",
      "What does a good day look like?"
    );
    const rows = await db.compassItems.toArray();
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((row) => row.id)).size).toBe(4);
  });

  it("stores what was asked with a knowledge answer, and nothing for an empty question", async () => {
    const asked = await addKnowledge(
      "Right after a walk",
      " When do you feel most like yourself? "
    );
    const free = await addKnowledge("I've been reading before bed", "   ");
    expect(asked.question).toBe("When do you feel most like yourself?");
    expect(free.question).toBeNull();
  });
});

describe("goals and what they are measured by", () => {
  it("can be linked to one habit or one group, never both", async () => {
    const byActivity = await addGoal("Walk daily", { activityId: "a1" });
    const byGroup = await addGoal("Get fit", { groupId: "g1" });
    expect(byActivity).toMatchObject({ activity_id: "a1", group_id: null });
    expect(byGroup).toMatchObject({ activity_id: null, group_id: "g1" });
    await expect(
      addGoal("Both", { activityId: "a1", groupId: "g1" })
    ).rejects.toMatchObject({ code: "link_conflict" });
  });

  it("changes and removes its link when edited", async () => {
    const goal = await addGoal("Walk daily", { activityId: "a1" });
    await editCompassItem(goal.id, { link: { groupId: "g1" } });
    expect(await db.compassItems.get(goal.id)).toMatchObject({
      activity_id: null,
      group_id: "g1",
    });
    await editCompassItem(goal.id, { link: {} });
    expect(await db.compassItems.get(goal.id)).toMatchObject({
      activity_id: null,
      group_id: null,
    });
  });

  it("ignores a link on anything that is not a goal", async () => {
    const word = await addIdentityWord("Patient");
    await editCompassItem(word.id, { link: { activityId: "a1" } });
    expect(await db.compassItems.get(word.id)).toMatchObject({
      activity_id: null,
    });
  });

  it("keeps its words when the habit it points at is archived or gone", async () => {
    const goal = await addGoal("Walk daily", {
      activityId: "no-such-activity",
    });
    expect(await db.compassItems.get(goal.id)).toMatchObject({
      text: "Walk daily",
      activity_id: "no-such-activity",
    });
  });
});

describe("editing", () => {
  it("overwrites the row and bases the operation on the version it replaced", async () => {
    const goal = await addGoal("Walk daily");
    await editCompassItem(goal.id, { text: "Walk every day" });
    const [create, edit] = await queue();
    expect(create.base_revision).toBeNull();
    expect(edit.base_revision).toBe(goal.updated_at);
    expect(await db.compassItems.get(goal.id)).toMatchObject({
      text: "Walk every day",
    });
  });

  it("validates the new text like the old", async () => {
    const goal = await addGoal("Walk daily");
    await expect(editCompassItem(goal.id, { text: " " })).rejects.toMatchObject(
      {
        code: "empty",
      }
    );
    expect((await db.compassItems.get(goal.id))?.text).toBe("Walk daily");
  });

  it("does nothing for a row that is not here", async () => {
    await editCompassItem("missing", { text: "x" });
    expect(await queue()).toHaveLength(0);
  });
});

describe("lifecycle: set aside, delete, restore", () => {
  it("sets aside and restores without losing the words", async () => {
    const goal = await addGoal("Walk daily");
    await archiveCompassItem(goal.id);
    expect((await db.compassItems.get(goal.id))?.archived_at).not.toBeNull();
    await restoreCompassItem(goal.id);
    expect(await db.compassItems.get(goal.id)).toMatchObject({
      text: "Walk daily",
      archived_at: null,
    });
  });

  it("deletes as a tombstone that is still on the device and restorable", async () => {
    const goal = await addGoal("Walk daily");
    await deleteCompassItem(goal.id);
    const row = await db.compassItems.get(goal.id);
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.text).toBe("Walk daily");
    await restoreCompassItem(goal.id);
    expect((await db.compassItems.get(goal.id))?.deleted_at).toBeNull();
  });

  it("queues exactly one operation per action", async () => {
    const goal = await addGoal("Walk daily");
    await archiveCompassItem(goal.id);
    await restoreCompassItem(goal.id);
    await deleteCompassItem(goal.id);
    expect(await queue()).toHaveLength(4);
  });
});

describe("groupCompassItems", () => {
  it("sorts rows into the lists the compass shows, oldest first", () => {
    const rows = [
      item({ kind: "north_star", text: "Star" }),
      item({
        kind: "identity",
        text: "Second",
        created_at: "2026-10-19T12:00:00.000Z",
      }),
      item({
        kind: "identity",
        text: "First",
        created_at: "2026-10-19T11:00:00.000Z",
      }),
      item({
        kind: "goal",
        text: "Aside",
        archived_at: "2026-10-19T13:00:00.000Z",
      }),
      item({
        kind: "goal",
        text: "Gone",
        deleted_at: "2026-10-19T13:00:00.000Z",
      }),
      item({ kind: "knowledge", text: "Told" }),
    ];
    const out = groupCompassItems(rows);
    expect(out.northStar?.text).toBe("Star");
    expect(out.identity.map((r) => r.text)).toEqual(["First", "Second"]);
    expect(out.goals).toEqual([]);
    expect(out.knowledge.map((r) => r.text)).toEqual(["Told"]);
    expect(out.archived.map((r) => r.text)).toEqual(["Aside"]);
    expect(out.deleted.map((r) => r.text)).toEqual(["Gone"]);
  });

  it("has no north star when there is none, or when it is set aside", () => {
    expect(groupCompassItems([]).northStar).toBeNull();
    const aside = item({
      kind: "north_star",
      archived_at: "2026-10-19T13:00:00.000Z",
    });
    expect(groupCompassItems([aside]).northStar).toBeNull();
    expect(groupCompassItems([aside]).archived).toHaveLength(1);
  });
});

describe("leaving the account", () => {
  it("counts a compass row that has not synced, so sign-out does not discard it", async () => {
    expect((await getLocalSyncSafetyStatus()).unsyncedRowCount).toBe(0);
    await addGoal("Walk daily");
    const status = await getLocalSyncSafetyStatus();
    expect(status.unsyncedRowCount).toBeGreaterThanOrEqual(1);
    expect(status.hasUnsyncedData).toBe(true);
  });
});
