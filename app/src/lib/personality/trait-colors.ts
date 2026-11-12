import type { Trait } from "./items";

/** One palette token per trait, so each is recognisable at a glance. */
const TOKEN: Record<Trait, string> = {
  openness: "--lavender",
  conscientiousness: "--green",
  extraversion: "--gold",
  agreeableness: "--terracotta",
  neuroticism: "--sky",
};

/** A CSS colour for a trait, from theme tokens, with an optional alpha 0-1. */
export function traitColor(trait: Trait, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(${TOKEN[trait]}))`
    : `hsl(var(${TOKEN[trait]}) / ${alpha})`;
}
