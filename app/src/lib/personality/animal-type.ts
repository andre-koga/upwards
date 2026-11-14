import { TRAITS, type Trait, type TraitScores } from "./items";

/**
 * The playful layer on top of the Big Five (OCEAN). Each trait is read as high
 * or low, which gives five letters and 2^5 = 32 types. It is for fun, not a
 * clinical category: the scores underneath are what the test measures.
 */

export type Pole = "low" | "high";

/**
 * One letter per trait pole, ten distinct letters in all. The legend names
 * each one: Open / Grounded, Planned / Flexible, Extravert / Introvert,
 * Warm / Direct, Sensitive / Calm.
 */
export const TRAIT_LETTERS: Record<Trait, Record<Pole, string>> = {
  openness: { high: "O", low: "G" },
  conscientiousness: { high: "P", low: "F" },
  extraversion: { high: "E", low: "I" },
  agreeableness: { high: "W", low: "D" },
  neuroticism: { high: "S", low: "C" },
};

export type AnimalGroup = "savanna" | "night" | "farm" | "woodland";

export const ANIMAL_GROUPS: readonly AnimalGroup[] = [
  "savanna",
  "night",
  "farm",
  "woodland",
];

/** The theme token for each group's colour. */
const GROUP_TOKEN: Record<AnimalGroup, string> = {
  savanna: "--gold",
  night: "--lavender",
  farm: "--terracotta",
  woodland: "--green",
};

/** A CSS colour for a group, from theme tokens, with an optional alpha 0-1. */
export function groupColor(group: AnimalGroup, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(${GROUP_TOKEN[group]}))`
    : `hsl(var(${GROUP_TOKEN[group]}) / ${alpha})`;
}

/**
 * Each group has its own pair of colours for the portrait wash, picked to
 * match how the group feels: [upper, lower].
 * - savanna: warm sun and big herds, bright and lively
 * - night: twilight and open sky, far out and quiet
 * - farm: dusk over the yard, grounded and warm
 * - woodland: green shade, calm and sheltered
 */
const GROUP_PAIR: Record<AnimalGroup, readonly [string, string]> = {
  savanna: ["--gold", "--terracotta"],
  night: ["--lavender", "--sky"],
  farm: ["--terracotta", "--lavender"],
  woodland: ["--green", "--sky"],
};

function tokenColor(token: string, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(${token}))`
    : `hsl(var(${token}) / ${alpha})`;
}

/** The two colours of a group's wash, [upper, lower], with an optional alpha. */
export function groupPairColors(
  group: AnimalGroup,
  alpha?: number
): [string, string] {
  const [upper, lower] = GROUP_PAIR[group];
  return [tokenColor(upper, alpha), tokenColor(lower, alpha)];
}

export const ANIMAL_TYPE_IDS = [
  "elephant",
  "lion",
  "cheetah",
  "giraffe",
  "flamingo",
  "monkey",
  "hyena",
  "zebra",
  "owl",
  "wolf",
  "bat",
  "spider",
  "firefly",
  "sloth",
  "fox",
  "raccoon",
  "hen",
  "dog",
  "horse",
  "ox",
  "lamb",
  "pig",
  "goose",
  "goat",
  "squirrel",
  "tortoise",
  "hedgehog",
  "badger",
  "rabbit",
  "bear",
  "deer",
  "koala",
] as const;

export type AnimalTypeId = (typeof ANIMAL_TYPE_IDS)[number];

/**
 * The group comes from openness and extraversion (how far you reach, and how
 * much of that is shared with others). Inside a group, the eight names follow
 * conscientiousness, agreeableness and neuroticism in that order, high first.
 */
const NAMES: Record<AnimalGroup, readonly AnimalTypeId[]> = {
  // C A N:  +++      ++-      +-+      +--      -++      -+-      --+      ---
  savanna: [
    "elephant",
    "lion",
    "cheetah",
    "giraffe",
    "flamingo",
    "monkey",
    "hyena",
    "zebra",
  ],
  night: ["owl", "wolf", "bat", "spider", "firefly", "sloth", "fox", "raccoon"],
  farm: ["hen", "dog", "horse", "ox", "lamb", "pig", "goose", "goat"],
  woodland: [
    "squirrel",
    "tortoise",
    "hedgehog",
    "badger",
    "rabbit",
    "bear",
    "deer",
    "koala",
  ],
};

export interface AnimalLetter {
  trait: Trait;
  pole: Pole;
  letter: string;
}

export interface AnimalType {
  id: AnimalTypeId;
  group: AnimalGroup;
  /** The five letters in OCEAN order, such as "OPEWC". */
  code: string;
  letters: AnimalLetter[];
}

/** 50 is the line: a score at or above it reads as high. */
function poleOf(score: number): Pole {
  return score >= 50 ? "high" : "low";
}

function groupOf(openness: Pole, extraversion: Pole): AnimalGroup {
  if (openness === "high") return extraversion === "high" ? "savanna" : "night";
  return extraversion === "high" ? "farm" : "woodland";
}

/**
 * All 32 types, habitat by habitat, in the order of the names above. Each one
 * is read back through `animalType`, so a listing can never disagree with what
 * the test would give.
 */
export function allAnimalTypes(): AnimalType[] {
  return ANIMAL_GROUPS.flatMap((group) =>
    NAMES[group].map((_, index) => {
      const open = group === "savanna" || group === "night";
      const extravert = group === "savanna" || group === "farm";
      // The same bits `animalType` reads: low sets a bit, high first.
      return animalType({
        openness: open ? 75 : 25,
        conscientiousness: index & 4 ? 25 : 75,
        extraversion: extravert ? 75 : 25,
        agreeableness: index & 2 ? 25 : 75,
        neuroticism: index & 1 ? 25 : 75,
      });
    })
  );
}

/**
 * The perfect opposite: the type with the other pole on all five letters, so
 * Open becomes Grounded, Planned becomes Flexible, and so on. Every type has
 * exactly one, and the opposite of the opposite is the type itself.
 */
export function oppositeType(type: AnimalType): AnimalType {
  const flipped = Object.fromEntries(
    type.letters.map(({ trait, pole }) => [trait, pole === "high" ? 25 : 75])
  ) as TraitScores;
  return animalType(flipped);
}

/** The type for a set of trait scores. Always one of the 32. */
export function animalType(scores: TraitScores): AnimalType {
  const letters: AnimalLetter[] = TRAITS.map((trait) => {
    const pole = poleOf(scores[trait]);
    return { trait, pole, letter: TRAIT_LETTERS[trait][pole] };
  });
  const poles = Object.fromEntries(
    letters.map((l) => [l.trait, l.pole])
  ) as Record<Trait, Pole>;

  const group = groupOf(poles.openness, poles.extraversion);
  // Index 0 is C+A+N+, then counting down in binary: low sets a bit.
  const index =
    (poles.conscientiousness === "low" ? 4 : 0) +
    (poles.agreeableness === "low" ? 2 : 0) +
    (poles.neuroticism === "low" ? 1 : 0);

  return {
    id: NAMES[group][index],
    group,
    code: letters.map((l) => l.letter).join(""),
    letters,
  };
}
