import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => "44444444-4444-4444-8444-444444444444",
  getQueueAccountId: () => "44444444-4444-4444-8444-444444444444",
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-a",
}));
vi.mock("@/lib/sync/sync-scheduler", () => ({
  requestDebouncedSync: () => undefined,
}));

import { db } from "@/lib/db";
import {
  answerQuestion,
  completedSittings,
  currentSitting,
  startSitting,
} from "./store";
import { ITEMS } from "./items";

beforeEach(async () => {
  await db.personalitySittings.clear();
  await db.syncPendingOperations.clear();
});

describe("sitting store", () => {
  it("starts a sitting and saves progress after every answer", async () => {
    const sitting = await startSitting();
    expect(await currentSitting()).toMatchObject({ id: sitting.id });

    await answerQuestion(sitting.id, ITEMS[0].id, 4);
    await answerQuestion(sitting.id, ITEMS[1].id, 2);
    const saved = await db.personalitySittings.get(sitting.id);
    expect(saved?.answers).toEqual({ [ITEMS[0].id]: 4, [ITEMS[1].id]: 2 });
    expect(saved?.completed_at).toBeNull();
    expect(saved?.scores).toBeNull();
  });

  it("queues one projection op per save, with the row id as the entity", async () => {
    const sitting = await startSitting();
    await answerQuestion(sitting.id, ITEMS[0].id, 4);
    const ops = await db.syncPendingOperations.toArray();
    expect(ops.length).toBe(2);
    expect(ops.every((op) => op.entity_type === "personality_sitting")).toBe(
      true
    );
    expect(ops.every((op) => op.entity_id === sitting.id)).toBe(true);
  });

  it("completes on the fiftieth answer and scores it", async () => {
    const sitting = await startSitting();
    for (const item of ITEMS) await answerQuestion(sitting.id, item.id, 3);
    const done = await db.personalitySittings.get(sitting.id);
    expect(done?.completed_at).not.toBeNull();
    expect(done?.scores?.openness).toBe(50);
    expect(await currentSitting()).toBeNull();
    expect(await completedSittings()).toHaveLength(1);
  });

  it("ignores invalid answers and unknown items", async () => {
    const sitting = await startSitting();
    await answerQuestion(sitting.id, ITEMS[0].id, 9);
    await answerQuestion(sitting.id, "ZZ", 3);
    expect((await db.personalitySittings.get(sitting.id))?.answers).toEqual({});
  });

  it("keeps the earlier sitting when taking the test again", async () => {
    const first = await startSitting();
    for (const item of ITEMS) await answerQuestion(first.id, item.id, 3);
    const second = await startSitting();
    expect(second.id).not.toBe(first.id);
    const done = await completedSittings();
    expect(done.map((s) => s.id)).toEqual([first.id]);
    expect((await currentSitting())?.id).toBe(second.id);
  });
});
