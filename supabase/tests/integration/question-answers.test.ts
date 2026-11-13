import { beforeAll, describe, expect, it } from "vitest";
import {
  createIsolatedUser,
  newId,
  pullSnapshot,
  submitOps,
  type IsolatedUser,
  type SyncOpInput,
} from "./helpers";

const T0 = "2026-11-13T10:00:00.000Z";
// Creating a dozen accounts takes longer than the default test timeout.
const SLOW = 60_000;
const T1 = "2026-11-13T10:05:00.000Z";

/**
 * The local database keeps its rows between runs and the crowd counts everyone,
 * so each crowd test asks a question id no earlier run has used.
 */
function freshQuestion(): string {
  return `t${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function answerOp(
  deviceId: string,
  id: string,
  row: Record<string, unknown>,
  base: string | null,
  operationId: string = newId(),
): SyncOpInput {
  return {
    operation_id: operationId,
    device_id: deviceId,
    entity_type: "question_answer",
    entity_id: id,
    operation_type: "projection.upsert",
    payload: {
      row: {
        id,
        question_id: "o1",
        choice_id: "a",
        why: null,
        answered_on: "2026-11-13",
        in_crowd: true,
        created_at: T0,
        updated_at: T0,
        deleted_at: null,
        ...row,
      },
    },
    base_revision: base,
  };
}

async function answer(
  user: IsolatedUser,
  row: Record<string, unknown> = {},
): Promise<string> {
  const id = newId();
  const [result] = await submitOps(user.deviceA, [
    answerOp("a", id, row, null),
  ]);
  expect(result.status).toBe("accepted");
  return id;
}

async function results(user: IsolatedUser, questionId: string) {
  return user.deviceA.rpc("question_results", { p_question_id: questionId });
}

describe("question answers sync", () => {
  let user: IsolatedUser;
  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  it("accepts an answer and returns it in the snapshot", async () => {
    const id = newId();
    const [saved] = await submitOps(user.deviceA, [
      answerOp("a", id, { why: "because" }, null),
    ]);
    expect(saved.status).toBe("accepted");

    const snapshot = await pullSnapshot(user.deviceB);
    const stored = (
      snapshot.question_answers as Array<Record<string, unknown>>
    ).find((row) => row.id === id);
    expect(stored).toMatchObject({
      question_id: "o1",
      choice_id: "a",
      why: "because",
      answered_on: "2026-11-13",
      in_crowd: true,
    });
  });

  it("lets the same device change its mind from its own base", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      answerOp("a", id, { answered_on: "2026-11-14" }, null),
    ]);
    const [changed] = await submitOps(user.deviceA, [
      answerOp(
        "a",
        id,
        { answered_on: "2026-11-14", choice_id: "b", updated_at: T1 },
        T0,
      ),
    ]);
    expect(changed.status).toBe("accepted");
  });

  it("treats a replayed operation as a duplicate", async () => {
    const id = newId();
    const operationId = newId();
    const op = answerOp(
      "a",
      id,
      { answered_on: "2026-11-15" },
      null,
      operationId,
    );
    const [first] = await submitOps(user.deviceA, [op]);
    const [second] = await submitOps(user.deviceA, [op]);
    expect(first.status).toBe("accepted");
    expect(second.status).toBe("duplicate");
    expect(second.server_sequence).toBe(first.server_sequence);
  });

  it("records a conflict when two devices start the same day from nothing", async () => {
    const id = newId();
    const [first] = await submitOps(user.deviceA, [
      answerOp("a", id, { answered_on: "2026-11-16", choice_id: "a" }, null),
    ]);
    const [second] = await submitOps(user.deviceB, [
      answerOp("b", id, { answered_on: "2026-11-16", choice_id: "c" }, null),
    ]);
    expect(first.status).toBe("accepted");
    expect(second.status).toBe("conflict");

    const snapshot = await pullSnapshot(user.deviceA);
    const stored = (
      snapshot.question_answers as Array<Record<string, unknown>>
    ).find((row) => row.id === id);
    expect(stored?.choice_id).toBe("a");
  });

  it("allows only one live answer per day", async () => {
    await answer(user, { answered_on: "2026-11-17" });
    const [second] = await submitOps(user.deviceA, [
      answerOp("a", newId(), { answered_on: "2026-11-17" }, null),
    ]);
    expect(second.status).toBe("error");
  });

  it("rejects an oversized note", async () => {
    const [result] = await submitOps(user.deviceA, [
      answerOp(
        "a",
        newId(),
        { why: "x".repeat(281), answered_on: "2026-11-18" },
        null,
      ),
    ]);
    expect(result.status).toBe("error");
  });

  it("keeps one account out of another's rows", async () => {
    const other = await createIsolatedUser();
    const id = await answer(user, { answered_on: "2026-11-19" });

    const [stolen] = await submitOps(other.deviceA, [
      answerOp("x", id, { choice_id: "d" }, T0),
    ]);
    expect(stolen.status).toBe("error");

    const direct = await other.deviceA
      .from("question_answers")
      .select("id")
      .eq("id", id);
    expect(direct.data).toEqual([]);

    const write = await other.deviceA.from("question_answers").insert({
      id: newId(),
      user_id: other.userId,
      question_id: "o1",
      choice_id: "a",
      answered_on: "2026-11-20",
      created_at: T0,
      updated_at: T0,
    });
    expect(write.error).not.toBeNull();
  });
});

describe("question_results", () => {
  it("refuses until the caller has answered that question", async () => {
    const user = await createIsolatedUser();
    const refused = await results(user, "o2");
    expect(refused.error).not.toBeNull();

    // An answer to a different question does not open it.
    await answer(user, { question_id: "o1" });
    expect((await results(user, "o2")).error).not.toBeNull();
  });

  it("refuses an answer that was deleted", async () => {
    const user = await createIsolatedUser();
    const id = await answer(user, { question_id: "o3" });
    await submitOps(user.deviceA, [
      answerOp(
        "a",
        id,
        { question_id: "o3", deleted_at: T1, updated_at: T1 },
        T0,
      ),
    ]);
    expect((await results(user, "o3")).error).not.toBeNull();
  });

  it("says nothing, not even a number, under ten people", async () => {
    const crowded = freshQuestion();
    const users = await Promise.all(
      Array.from({ length: 3 }, () => createIsolatedUser()),
    );
    for (const u of users) await answer(u, { question_id: crowded });

    const result = await results(users[0], crowded);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ready: false });
  });

  it(
    "returns counts per choice once ten people are counted, and nothing else",
    { timeout: SLOW },
    async () => {
      const question = freshQuestion();
      const users = await Promise.all(
        Array.from({ length: 12 }, () => createIsolatedUser()),
      );
      // 5 a, 3 b, 2 c counted; one opted out; one deleted.
      const picks = ["a", "a", "a", "a", "a", "b", "b", "b", "c", "c"];
      for (let i = 0; i < picks.length; i += 1) {
        await answer(users[i], {
          question_id: question,
          choice_id: picks[i],
          why: "private words",
        });
      }
      await answer(users[10], {
        question_id: question,
        choice_id: "d",
        in_crowd: false,
      });
      const gone = await answer(users[11], {
        question_id: question,
        choice_id: "d",
      });
      await submitOps(users[11].deviceA, [
        answerOp(
          "a",
          gone,
          {
            question_id: question,
            choice_id: "d",
            deleted_at: T1,
            updated_at: T1,
          },
          T0,
        ),
      ]);

      const asked = await results(users[0], question);
      expect(asked.error).toBeNull();
      expect(asked.data).toEqual({
        ready: true,
        total: 10,
        counts: { a: 5, b: 3, c: 2 },
      });
      expect(JSON.stringify(asked.data)).not.toContain("private words");
      for (const u of users) {
        expect(JSON.stringify(asked.data)).not.toContain(u.userId);
      }

      // Someone who opted out can still see the crowd they are not part of.
      const optedOut = await results(users[10], question);
      expect(optedOut.data).toMatchObject({ ready: true, total: 10 });
    },
  );

  it(
    "counts a person once, by their latest answer",
    { timeout: SLOW },
    async () => {
      const question = freshQuestion();
      const users = await Promise.all(
        Array.from({ length: 10 }, () => createIsolatedUser()),
      );
      for (const u of users) {
        await answer(u, {
          question_id: question,
          choice_id: "a",
          answered_on: "2026-10-01",
        });
      }
      // The first person is asked again a month later and picks differently.
      await answer(users[0], {
        question_id: question,
        choice_id: "b",
        answered_on: "2026-10-31",
      });

      const asked = await results(users[0], question);
      expect(asked.data).toEqual({
        ready: true,
        total: 10,
        counts: { a: 9, b: 1 },
      });
    },
  );

  it("is not callable without signing in", async () => {
    const user = await createIsolatedUser();
    const { createClient } = await import("@supabase/supabase-js");
    const { loadSupabaseEnv } = await import("./helpers");
    const env = loadSupabaseEnv();
    const anon = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const refused = await anon.rpc("question_results", { p_question_id: "o1" });
    expect(refused.error).not.toBeNull();
    expect(user.userId).toBeTruthy();
  });
});
