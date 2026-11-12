import {
  ANSWER_MAX,
  ANSWER_MIN,
  ITEMS,
  ITEM_COUNT,
  TRAITS,
  isValidAnswer,
  type PersonalityAnswers,
  type TraitScores,
} from "./items";

/** How many of the 50 items have a valid answer. Unknown ids are ignored. */
export function countAnswered(answers: PersonalityAnswers): number {
  let count = 0;
  for (const item of ITEMS) {
    if (isValidAnswer(answers[item.id])) count += 1;
  }
  return count;
}

/** The first unanswered item in presentation order, or null when finished. */
export function nextUnansweredIndex(
  answers: PersonalityAnswers
): number | null {
  const index = ITEMS.findIndex((item) => !isValidAnswer(answers[item.id]));
  return index === -1 ? null : index;
}

/**
 * Scores a finished sitting: reverse-key, take each trait's mean over its ten
 * items, and put it on 0-100. Returns null unless all 50 items hold an integer
 * answer from 1 to 5, so a partial sitting can never show a result.
 */
export function scoreSitting(answers: PersonalityAnswers): TraitScores | null {
  if (countAnswered(answers) !== ITEM_COUNT) return null;

  const sums: Record<string, { total: number; n: number }> = {};
  for (const item of ITEMS) {
    const raw = answers[item.id];
    const value = item.reverse ? ANSWER_MIN + ANSWER_MAX - raw : raw;
    const bucket = (sums[item.trait] ??= { total: 0, n: 0 });
    bucket.total += value;
    bucket.n += 1;
  }

  const scores = {} as TraitScores;
  for (const trait of TRAITS) {
    const { total, n } = sums[trait];
    const mean = total / n;
    scores[trait] = Math.round(
      ((mean - ANSWER_MIN) / (ANSWER_MAX - ANSWER_MIN)) * 100
    );
  }
  return scores;
}
