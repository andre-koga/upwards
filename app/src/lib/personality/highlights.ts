import { TRAITS, type Trait, type TraitScores } from "./items";
import { GAP_THRESHOLD } from "./bands";

/** The trait furthest from the middle of the scale. */
export function standoutTrait(scores: TraitScores): Trait {
  return TRAITS.reduce((best, trait) =>
    Math.abs(scores[trait] - 50) > Math.abs(scores[best] - 50) ? trait : best
  );
}

/** Where the journal and the test agree most, and disagree most. */
export function journalComparison(
  self: TraitScores,
  journal: TraitScores
): { closest: Trait; widest: Trait | null } {
  const gap = (trait: Trait) => Math.abs(self[trait] - journal[trait]);
  const closest = TRAITS.reduce((best, trait) =>
    gap(trait) < gap(best) ? trait : best
  );
  const widest = TRAITS.reduce((best, trait) =>
    gap(trait) > gap(best) ? trait : best
  );
  return { closest, widest: gap(widest) >= GAP_THRESHOLD ? widest : null };
}
