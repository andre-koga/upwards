import { TRAITS, type Trait, type TraitScores } from "./items";

export type Pole = "low" | "high";

export interface TypePole {
  trait: Trait;
  pole: Pole;
  /** Distance from the middle of the scale, 0-50. */
  strength: number;
}

export type TypeName =
  | { kind: "balanced" }
  | {
      kind: "named";
      /** The strongest trait; gives the adjective ("Curious"). */
      lead: TypePole;
      /** The noun's trait: the second strongest, or the lead again. */
      noun: TypePole;
      /** Up to two traits that define the type, strongest first. */
      defining: TypePole[];
    };

/** Below this, no trait stands out and the person reads as balanced. */
export const BALANCED_BELOW = 10;
/** A second trait only shapes the name if it also stands out a little. */
export const SECOND_FROM = 8;

function pole(trait: Trait, score: number): TypePole {
  return {
    trait,
    pole: score >= 50 ? "high" : "low",
    strength: Math.abs(score - 50),
  };
}

/**
 * Names a profile the way a type website does, from the traits that stand
 * furthest from the middle: the strongest gives the adjective and the next
 * gives the noun ("The Curious Builder"). With no strong trait, "balanced".
 * Ties go to the earlier trait in the usual order, so a result never flips.
 */
export function typeName(scores: TraitScores): TypeName {
  const ranked = TRAITS.map((trait) => pole(trait, scores[trait])).sort(
    (a, b) => b.strength - a.strength
  );
  const lead = ranked[0];
  if (lead.strength < BALANCED_BELOW) return { kind: "balanced" };

  const second = ranked[1];
  const hasSecond = second.strength >= SECOND_FROM;
  return {
    kind: "named",
    lead,
    noun: hasSecond ? second : lead,
    defining: hasSecond ? [lead, second] : [lead],
  };
}
