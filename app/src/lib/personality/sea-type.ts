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

export type SeaGroup = "reef" | "deep" | "shore" | "lagoon";

export const SEA_GROUPS: readonly SeaGroup[] = [
  "reef",
  "deep",
  "shore",
  "lagoon",
];

/** The theme token for each group's colour. */
const GROUP_TOKEN: Record<SeaGroup, string> = {
  reef: "--gold",
  deep: "--lavender",
  shore: "--terracotta",
  lagoon: "--green",
};

/** A CSS colour for a group, from theme tokens, with an optional alpha 0-1. */
export function groupColor(group: SeaGroup, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(${GROUP_TOKEN[group]}))`
    : `hsl(var(${GROUP_TOKEN[group]}) / ${alpha})`;
}

/**
 * The two letters that pick the group (openness and extraversion) each carry a
 * colour, chosen so a group's own colour is always one of its two:
 * reef = O + E (gold), deep = O + I (lavender), shore = G + E (terracotta),
 * lagoon = G + I (green).
 */
const REACH_TOKEN: Record<Pole, string> = {
  high: "--lavender", // O
  low: "--terracotta", // G
};
const COMPANY_TOKEN: Record<Pole, string> = {
  high: "--gold", // E
  low: "--green", // I
};

function tokenColor(token: string, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(${token}))`
    : `hsl(var(${token}) / ${alpha})`;
}

/** The colours of the two letters that choose the group: [openness, extraversion]. */
export function groupLetterColors(
  type: SeaType,
  alpha?: number
): [string, string] {
  const pole = (trait: Trait): Pole =>
    type.letters.find((l) => l.trait === trait)?.pole ?? "low";
  return [
    tokenColor(REACH_TOKEN[pole("openness")], alpha),
    tokenColor(COMPANY_TOKEN[pole("extraversion")], alpha),
  ];
}

export const SEA_TYPE_IDS = [
  "dolphin",
  "clownfish",
  "orca",
  "barracuda",
  "otter",
  "angelfish",
  "marlin",
  "triggerfish",
  "whale",
  "seahorse",
  "nautilus",
  "moray",
  "ray",
  "jellyfish",
  "octopus",
  "anglerfish",
  "lighthouse",
  "sandpiper",
  "anchor",
  "pufferfish",
  "seal",
  "starfish",
  "gull",
  "crab",
  "turtle",
  "hermit",
  "limpet",
  "urchin",
  "manatee",
  "anemone",
  "flounder",
  "stonefish",
] as const;

export type SeaTypeId = (typeof SEA_TYPE_IDS)[number];

/**
 * The group comes from openness and extraversion (how far you reach, and how
 * much of that is shared with others). Inside a group, the eight names follow
 * conscientiousness, agreeableness and neuroticism in that order, high first.
 */
const NAMES: Record<SeaGroup, readonly SeaTypeId[]> = {
  // C A N:  +++      ++-      +-+      +--      -++      -+-      --+      ---
  reef: [
    "clownfish",
    "dolphin",
    "barracuda",
    "orca",
    "angelfish",
    "otter",
    "triggerfish",
    "marlin",
  ],
  deep: [
    "seahorse",
    "whale",
    "moray",
    "nautilus",
    "jellyfish",
    "ray",
    "anglerfish",
    "octopus",
  ],
  shore: [
    "sandpiper",
    "lighthouse",
    "pufferfish",
    "anchor",
    "starfish",
    "seal",
    "crab",
    "gull",
  ],
  lagoon: [
    "hermit",
    "turtle",
    "urchin",
    "limpet",
    "anemone",
    "manatee",
    "stonefish",
    "flounder",
  ],
};

export interface SeaLetter {
  trait: Trait;
  pole: Pole;
  letter: string;
}

export interface SeaType {
  id: SeaTypeId;
  group: SeaGroup;
  /** The five letters in OCEAN order, such as "OPEWC". */
  code: string;
  letters: SeaLetter[];
}

/** 50 is the line: a score at or above it reads as high. */
function poleOf(score: number): Pole {
  return score >= 50 ? "high" : "low";
}

function groupOf(openness: Pole, extraversion: Pole): SeaGroup {
  if (openness === "high") return extraversion === "high" ? "reef" : "deep";
  return extraversion === "high" ? "shore" : "lagoon";
}

/** The type for a set of trait scores. Always one of the 32. */
export function seaType(scores: TraitScores): SeaType {
  const letters: SeaLetter[] = TRAITS.map((trait) => {
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
