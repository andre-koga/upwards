import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { questionForDate } from "./daily";
import {
  answerToday,
  crowdPreference,
  liveAnswers,
  setCrowdPreference,
} from "./store";

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0));
  await db.questionAnswers.clear();
  await db.syncPendingOperations.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("question answer store", () => {
  it("saves today's answer and queues one projection op", async () => {
    const question = questionForDate("2026-11-13");
    const saved = await answerToday({
      choiceId: question.choices[0].id,
      why: "  because  ",
    });
    expect(saved).toMatchObject({
      question_id: question.id,
      choice_id: question.choices[0].id,
      why: "because",
      answered_on: "2026-11-13",
      in_crowd: true,
      deleted_at: null,
    });
    const ops = await db.syncPendingOperations.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      entity_type: "question_answer",
      entity_id: saved!.id,
    });
  });

  it("refuses a choice that is not part of today's question", async () => {
    expect(await answerToday({ choiceId: "zz", why: "" })).toBeNull();
    expect(await db.questionAnswers.count()).toBe(0);
  });

  it("changing your mind edits the same row", async () => {
    const question = questionForDate("2026-11-13");
    const first = await answerToday({
      choiceId: question.choices[0].id,
      why: "",
    });
    vi.setSystemTime(new Date(2026, 10, 13, 18, 0, 0));
    const second = await answerToday({
      choiceId: question.choices[1].id,
      why: "",
    });
    expect(second!.id).toBe(first!.id);
    expect(second!.created_at).toBe(first!.created_at);
    expect(await db.questionAnswers.count()).toBe(1);
    expect((await db.questionAnswers.get(first!.id))!.choice_id).toBe(
      question.choices[1].id
    );
  });

  it("caps the private note", async () => {
    const question = questionForDate("2026-11-13");
    const saved = await answerToday({
      choiceId: question.choices[0].id,
      why: "x".repeat(1000),
    });
    expect(saved!.why).toHaveLength(280);
  });

  it("uses a different row on a different day", async () => {
    const question = questionForDate("2026-11-13");
    await answerToday({ choiceId: question.choices[0].id, why: "" });
    vi.setSystemTime(new Date(2026, 10, 14, 9, 0, 0));
    const next = questionForDate("2026-11-14");
    await answerToday({ choiceId: next.choices[0].id, why: "" });
    expect(await db.questionAnswers.count()).toBe(2);
    expect((await liveAnswers())[0].answered_on).toBe("2026-11-14");
  });

  it("the crowd switch applies to every answer and to the next one", async () => {
    const question = questionForDate("2026-11-13");
    await answerToday({ choiceId: question.choices[0].id, why: "" });
    expect(crowdPreference(await liveAnswers())).toBe(true);

    await setCrowdPreference(false);
    expect((await liveAnswers()).every((a) => !a.in_crowd)).toBe(true);
    expect(crowdPreference(await liveAnswers())).toBe(false);

    vi.setSystemTime(new Date(2026, 10, 14, 9, 0, 0));
    const next = questionForDate("2026-11-14");
    const saved = await answerToday({ choiceId: next.choices[0].id, why: "" });
    expect(saved!.in_crowd).toBe(false);
  });
});
