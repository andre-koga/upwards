/**
 * The instrument: Goldberg's IPIP Big-Five Factor Markers, 50 items, ten per
 * trait. The IPIP is public domain. Items are keyed by stable ids; the wording
 * lives in `locales/{en,pt}/personality.json` under `items.<id>`.
 */

export const TRAITS = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as const;

export type Trait = (typeof TRAITS)[number];

export type TraitScores = Record<Trait, number>;

export interface PersonalityItem {
  id: string;
  trait: Trait;
  /** Reverse-keyed items are scored as `6 - answer`. */
  reverse: boolean;
}

export const ANSWER_MIN = 1;
export const ANSWER_MAX = 5;

/** Positional keys: `+` is keyed forward, `-` is reverse-keyed. */
const KEYS: Record<Trait, { prefix: string; keys: string }> = {
  extraversion: { prefix: "E", keys: "+-+-+-+-+-" },
  agreeableness: { prefix: "A", keys: "-+-+-+-+++" },
  conscientiousness: { prefix: "C", keys: "+-+-+-+-++" },
  neuroticism: { prefix: "N", keys: "+-+-++++++" },
  openness: { prefix: "O", keys: "+-+-+-++++" },
};

/**
 * Presentation order interleaves the traits so neighbouring questions do not
 * all ask about the same thing: item 1 of each trait, then item 2, and so on.
 */
const ORDER: Trait[] = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
];

export const ITEMS: readonly PersonalityItem[] = Array.from(
  { length: 10 },
  (_, index) =>
    ORDER.map((trait): PersonalityItem => {
      const { prefix, keys } = KEYS[trait];
      return {
        id: `${prefix}${index + 1}`,
        trait,
        reverse: keys[index] === "-",
      };
    })
).flat();

export const ITEM_COUNT = ITEMS.length;

export const ITEM_IDS: readonly string[] = ITEMS.map((item) => item.id);

/** Answers by item id, each 1 (very inaccurate) to 5 (very accurate). */
export type PersonalityAnswers = Record<string, number>;

export function isValidAnswer(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= ANSWER_MIN &&
    value <= ANSWER_MAX
  );
}
