import { db, now } from "@/lib/db";
import type { QuestionAnswer } from "@/lib/db/types";
import { saveQuestionAnswer } from "@/lib/sync/mutate-synced";
import { naturalQuestionAnswerIdForDate } from "@/lib/sync/natural-ids";
import { todayDateString } from "@/lib/time-utils";
import { MAX_WHY_LENGTH, isValidChoice } from "./bank";
import { questionForDate } from "./daily";

/** Live answers, newest day first. */
export async function liveAnswers(): Promise<QuestionAnswer[]> {
  const rows = await db.questionAnswers.toArray();
  return rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => b.answered_on.localeCompare(a.answered_on));
}

/**
 * Whether answers are counted in the anonymous results. One switch for all of
 * them; it follows the most recent answer, and is on before there is one.
 */
export function crowdPreference(answers: readonly QuestionAnswer[]): boolean {
  return answers[0]?.in_crowd ?? true;
}

/**
 * Saves today's answer. The row id comes from the day, so changing your mind
 * before midnight edits the same row, and the same day on another device meets
 * it as a conflict to review rather than a second answer.
 */
export async function answerToday(input: {
  choiceId: string;
  why: string;
}): Promise<QuestionAnswer | null> {
  const date = todayDateString();
  const question = questionForDate(date);
  if (!isValidChoice(question.id, input.choiceId)) return null;

  const id = naturalQuestionAnswerIdForDate(date);
  const existing = await db.questionAnswers.get(id);
  const stamp = now();
  const why = input.why.trim().slice(0, MAX_WHY_LENGTH);
  const preference = crowdPreference(await liveAnswers());

  const row: QuestionAnswer = {
    id,
    question_id: question.id,
    choice_id: input.choiceId,
    why: why.length > 0 ? why : null,
    answered_on: date,
    in_crowd: existing && !existing.deleted_at ? existing.in_crowd : preference,
    created_at: existing?.created_at ?? stamp,
    updated_at: stamp,
    synced_at: null,
    deleted_at: null,
  };
  await saveQuestionAnswer(row, existing?.updated_at ?? null);
  return row;
}

/** Counts every answer in, or out of, the anonymous results. */
export async function setCrowdPreference(inCrowd: boolean): Promise<void> {
  const answers = await liveAnswers();
  for (const answer of answers) {
    if (answer.in_crowd === inCrowd) continue;
    await saveQuestionAnswer(
      { ...answer, in_crowd: inCrowd, updated_at: now() },
      answer.updated_at
    );
  }
}
