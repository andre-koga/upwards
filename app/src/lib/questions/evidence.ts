import type { QuestionAnswer } from "@/lib/db/types";
import { band, type Band } from "@/lib/personality/bands";
import { TRAITS, type Trait } from "@/lib/personality/items";
import { getQuestion } from "./bank";

/**
 * Answers needed on a trait before its choices are shown and compared with the
 * test. One is enough: the page says that a few answers are a rough guide.
 */
export const DRIFT_MIN_ANSWERS = 1;

/** A mean lean beyond this, either way, reads as leaning that way. */
const LEAN_FROM = 0.25;

export interface TraitEvidence {
  /** Answers to questions about this trait, neutral choices included. */
  count: number;
  /**
   * The mean lean of those choices from -1 (always the low end) to 1 (always
   * the high end). Zero when there are no answers.
   */
  lean: number;
}

export type Evidence = Record<Trait, TraitEvidence>;

export type Drift = "higher" | "lower" | null;

/** Tallies live answers by trait. This is evidence beside the test, never a score. */
export function tallyEvidence(answers: readonly QuestionAnswer[]): Evidence {
  const sums = Object.fromEntries(
    TRAITS.map((trait) => [trait, { count: 0, total: 0 }])
  ) as Record<Trait, { count: number; total: number }>;

  for (const answer of answers) {
    if (answer.deleted_at) continue;
    const question = getQuestion(answer.question_id);
    const choice = question?.choices.find((c) => c.id === answer.choice_id);
    if (!question || !choice) continue;
    const bucket = sums[question.trait];
    bucket.count += 1;
    if (choice.lean && choice.lean.trait === question.trait) {
      bucket.total += (choice.lean.direction * choice.lean.weight) / 2;
    }
  }

  return Object.fromEntries(
    TRAITS.map((trait) => {
      const { count, total } = sums[trait];
      return [trait, { count, lean: count === 0 ? 0 : total / count }];
    })
  ) as Evidence;
}

/** Where the choices sit, in the same three bands the test uses. */
export function leanBand(lean: number): Band {
  if (lean >= LEAN_FROM) return "high";
  if (lean <= -LEAN_FROM) return "low";
  return "mid";
}

const RANK: Record<Band, number> = { low: 0, mid: 1, high: 2 };

/**
 * Whether the choices sit in a different band from the test, once there are
 * enough of them to say so. "higher" means the choices lean higher than the
 * test did.
 */
export function driftFromTest(
  evidence: TraitEvidence,
  testScore: number
): Drift {
  if (evidence.count < DRIFT_MIN_ANSWERS) return null;
  const gap = RANK[leanBand(evidence.lean)] - RANK[band(testScore)];
  if (gap === 0) return null;
  return gap > 0 ? "higher" : "lower";
}
