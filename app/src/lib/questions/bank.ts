import { TRAITS, type Trait } from "@/lib/personality/items";

/**
 * Which way a choice leans on a trait: `direction` 1 is toward the high end of
 * the trait, -1 toward the low end, and `weight` is how strongly (1 or 2).
 */
export interface ChoiceLean {
  trait: Trait;
  direction: 1 | -1;
  weight: 1 | 2;
}

export interface QuestionChoice {
  /** Stable within the question: a, b, c, d. The wording is in the locale file. */
  id: string;
  /** Null for a choice that says nothing about the trait. */
  lean: ChoiceLean | null;
}

export interface Question {
  /** Stable forever: answers are stored against it. */
  id: string;
  /** The trait this question is about, used to space the daily rotation. */
  trait: Trait;
  choices: readonly QuestionChoice[];
}

export const QUESTIONS_PER_TRAIT = 6;

const CHOICE_IDS = ["a", "b", "c", "d"] as const;

/** A signed lean from -2 to 2 on `trait`; 0 is a neutral choice. */
function choice(trait: Trait, signed: -2 | -1 | 0 | 1 | 2) {
  return (id: string): QuestionChoice => ({
    id,
    lean:
      signed === 0
        ? null
        : {
            trait,
            direction: signed > 0 ? 1 : -1,
            weight: Math.abs(signed) as 1 | 2,
          },
  });
}

function question(
  id: string,
  trait: Trait,
  leans: ReadonlyArray<-2 | -1 | 0 | 1 | 2>
): Question {
  return {
    id,
    trait,
    choices: leans.map((signed, index) =>
      choice(trait, signed)(CHOICE_IDS[index])
    ),
  };
}

/**
 * The bundled bank, six questions per trait. Wording lives in
 * `locales/{en,pt}/questions.json` under `q.<id>`. Never reuse or renumber an
 * id; retire it and add a new one.
 */
export const QUESTIONS: readonly Question[] = [
  question("o1", "openness", [2, 1, 0, -1]),
  question("o2", "openness", [2, 1, 0, -1]),
  question("o3", "openness", [2, -2, 0]),
  question("o4", "openness", [2, 1, -1, -2]),
  question("o5", "openness", [2, 1, -1, -2]),
  question("o6", "openness", [2, 1, 0, -2]),

  question("c1", "conscientiousness", [2, 1, -1, -2]),
  question("c2", "conscientiousness", [2, 1, -1, -2]),
  question("c3", "conscientiousness", [2, 1, -1, -2]),
  question("c4", "conscientiousness", [2, 1, -1, -2]),
  question("c5", "conscientiousness", [2, 1, -1]),
  question("c6", "conscientiousness", [2, 1, -1, 0]),

  question("e1", "extraversion", [2, 1, -1, -2]),
  question("e2", "extraversion", [2, 1, -1, -2]),
  question("e3", "extraversion", [2, 1, -1]),
  question("e4", "extraversion", [2, 0, -1, -2]),
  question("e5", "extraversion", [2, 1, -1, -2]),
  question("e6", "extraversion", [2, 1, -1, -2]),

  question("a1", "agreeableness", [2, 1, -1, -2]),
  question("a2", "agreeableness", [2, 1, -1, 0]),
  question("a3", "agreeableness", [2, 1, -1, -2]),
  question("a4", "agreeableness", [2, 1, -1, -2]),
  question("a5", "agreeableness", [2, 1, 0, -1]),
  question("a6", "agreeableness", [2, 1, -1, -2]),

  question("n1", "neuroticism", [2, 1, -1, -2]),
  question("n2", "neuroticism", [2, 1, -2]),
  question("n3", "neuroticism", [2, 1, -1, -2]),
  question("n4", "neuroticism", [2, 1, -1, -2]),
  question("n5", "neuroticism", [2, 1, -1, -2]),
  question("n6", "neuroticism", [2, 1, -1, -2]),
];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id: string): Question | null {
  return BY_ID.get(id) ?? null;
}

/** The bank's questions for one trait, in bank order. */
export function questionsForTrait(trait: Trait): Question[] {
  return QUESTIONS.filter((q) => q.trait === trait);
}

export function isValidChoice(questionId: string, choiceId: string): boolean {
  return !!getQuestion(questionId)?.choices.some((c) => c.id === choiceId);
}

/** How many questions each trait has; the rotation needs them to be equal. */
export function bankIsBalanced(): boolean {
  return TRAITS.every(
    (trait) => questionsForTrait(trait).length === QUESTIONS_PER_TRAIT
  );
}
