import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createIsolatedUser,
  loadSupabaseEnv,
  newId,
  submitOps,
} from "./helpers";

const SLOW = 60_000;

function anonClient() {
  const env = loadSupabaseEnv();
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A day the server accepts: today, by its clock. */
function today(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return day.toISOString().slice(0, 10);
}

/** The crowd counts everyone, so each test asks a question no run has used. */
function freshQuestion(): string {
  return `t${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

async function guestAnswers(
  client: ReturnType<typeof anonClient>,
  question: string,
  choice: string,
  guestId: string = crypto.randomUUID(),
  answeredOn: string = today(),
) {
  return client.rpc("guest_question_results", {
    p_guest_id: guestId,
    p_question_id: question,
    p_choice_id: choice,
    p_answered_on: answeredOn,
  });
}

describe("guest_question_results", () => {
  it("says nothing under five, then counts per choice and nothing else", async () => {
    const anon = anonClient();
    const question = freshQuestion();

    for (const choice of ["a", "a", "b", "c"]) {
      const early = await guestAnswers(anon, question, choice);
      expect(early.error).toBeNull();
      expect(early.data).toEqual({ ready: false });
    }

    const fifth = await guestAnswers(anon, question, "a");
    expect(fifth.error).toBeNull();
    expect(fifth.data).toEqual({
      ready: true,
      total: 5,
      counts: { a: 3, b: 1, c: 1 },
    });
  });

  it("counts a guest once a day however many times they answer", async () => {
    const anon = anonClient();
    const question = freshQuestion();
    const guest = crypto.randomUUID();

    await guestAnswers(anon, question, "a", guest);
    await guestAnswers(anon, question, "a", guest);
    await guestAnswers(anon, question, "b", guest);
    for (let i = 0; i < 4; i += 1) await guestAnswers(anon, question, "c");

    const result = await guestAnswers(anon, question, "c", guest);
    // The guest changed their mind to c, so five people: one guest and four more.
    expect(result.data).toEqual({
      ready: true,
      total: 5,
      counts: { c: 5 },
    });
  });

  it(
    "counts guests and accounts together, and honours an opt-out",
    { timeout: SLOW },
    async () => {
      const anon = anonClient();
      const question = freshQuestion();
      const [one, two, three] = await Promise.all([
        createIsolatedUser(),
        createIsolatedUser(),
        createIsolatedUser(),
      ]);
      const answer = async (
        user: typeof one,
        choice: string,
        inCrowd: boolean,
      ) => {
        const id = newId();
        const [result] = await submitOps(user.deviceA, [
          {
            operation_id: newId(),
            device_id: "a",
            entity_type: "question_answer",
            entity_id: id,
            operation_type: "projection.upsert",
            payload: {
              row: {
                id,
                question_id: question,
                choice_id: choice,
                why: null,
                answered_on: today(),
                in_crowd: inCrowd,
                created_at: "2026-11-13T10:00:00.000Z",
                updated_at: "2026-11-13T10:00:00.000Z",
                deleted_at: null,
              },
            },
            base_revision: null,
          },
        ]);
        expect(result.status).toBe("accepted");
      };
      await answer(one, "a", true);
      await answer(two, "a", true);
      await answer(three, "b", false); // opted out: not counted

      await guestAnswers(anon, question, "b");
      await guestAnswers(anon, question, "b");
      const last = await guestAnswers(anon, question, "a");

      expect(last.data).toEqual({
        ready: true,
        total: 5,
        counts: { a: 3, b: 2 },
      });

      // An account that has answered sees the same numbers.
      const asked = await one.deviceA.rpc("question_results", {
        p_question_id: question,
      });
      expect(asked.data).toEqual(last.data);
    },
  );

  it("refuses answers that are malformed or on the wrong day", async () => {
    const anon = anonClient();
    const question = freshQuestion();
    const bad = [
      guestAnswers(anon, "Not A Question", "a"),
      guestAnswers(anon, question, "NOPE!"),
      guestAnswers(anon, question, "a", crypto.randomUUID(), today(-5)),
      guestAnswers(anon, question, "a", crypto.randomUUID(), today(5)),
    ];
    for (const result of await Promise.all(bad)) {
      expect(result.error).not.toBeNull();
    }
  });

  it("lets a guest see nothing but the function", async () => {
    const anon = anonClient();
    const table = await anon.from("guest_question_answers").select("*");
    expect(table.error).not.toBeNull();

    const direct = await anon.rpc("question_crowd", {
      p_question_id: freshQuestion(),
    });
    expect(direct.error).not.toBeNull();

    const accountsOnly = await anon.rpc("question_results", {
      p_question_id: freshQuestion(),
    });
    expect(accountsOnly.error).not.toBeNull();
  });
});
