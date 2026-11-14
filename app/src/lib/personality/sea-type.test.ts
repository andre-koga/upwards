import { describe, expect, it } from "vitest";
import en from "@/locales/en/personality.json";
import pt from "@/locales/pt/personality.json";
import { TRAITS, type TraitScores } from "./items";
import {
  LETTER_ORDER,
  SEA_GROUPS,
  SEA_TYPE_IDS,
  TRAIT_LETTERS,
  seaType,
  type SeaGroup,
} from "./sea-type";

const flat = (over: Partial<TraitScores> = {}): TraitScores => ({
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
  ...over,
});

/** Every one of the 32 high/low combinations as scores. */
function allCombinations(): TraitScores[] {
  return Array.from({ length: 32 }, (_, n) => {
    const scores = flat();
    TRAITS.forEach((trait, i) => {
      scores[trait] = n & (1 << i) ? 75 : 25;
    });
    return scores;
  });
}

describe("seaType", () => {
  it("reads 50 and above as high, below as low", () => {
    expect(seaType(flat()).code).toBe("EOPWS");
    expect(seaType(flat({ openness: 49 })).code).toBe("EGPWS");
  });

  it("writes extraversion first, then openness, then the rest", () => {
    const type = seaType(
      flat({
        openness: 90,
        conscientiousness: 10,
        extraversion: 10,
        agreeableness: 90,
        neuroticism: 10,
      })
    );
    expect(type.code).toBe("IOFWC");
    expect(type.letters.map((l) => l.trait)).toEqual([...LETTER_ORDER]);
  });

  it("uses ten distinct letters", () => {
    const letters = TRAITS.flatMap((t) => Object.values(TRAIT_LETTERS[t]));
    expect(new Set(letters).size).toBe(10);
  });

  it("reads extraversion as E or I", () => {
    expect(TRAIT_LETTERS.extraversion).toEqual({ high: "E", low: "I" });
  });

  it("gives all 32 combinations their own code and their own name", () => {
    const types = allCombinations().map(seaType);
    expect(new Set(types.map((t) => t.code)).size).toBe(32);
    expect(new Set(types.map((t) => t.id)).size).toBe(32);
    expect(new Set(types.map((t) => t.id))).toEqual(new Set(SEA_TYPE_IDS));
  });

  it("splits the 32 into four groups of eight", () => {
    const counts = new Map<SeaGroup, number>();
    for (const type of allCombinations().map(seaType)) {
      counts.set(type.group, (counts.get(type.group) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...SEA_GROUPS].sort());
    expect([...counts.values()]).toEqual([8, 8, 8, 8]);
  });

  it("groups by openness and extraversion", () => {
    expect(seaType(flat({ openness: 80, extraversion: 80 })).group).toBe(
      "reef"
    );
    expect(seaType(flat({ openness: 80, extraversion: 20 })).group).toBe(
      "deep"
    );
    expect(seaType(flat({ openness: 20, extraversion: 80 })).group).toBe(
      "shore"
    );
    expect(seaType(flat({ openness: 20, extraversion: 20 })).group).toBe(
      "lagoon"
    );
  });

  it("is stable: the same scores always give the same type", () => {
    const scores = flat({ openness: 63, neuroticism: 12 });
    expect(seaType(scores)).toEqual(seaType({ ...scores }));
  });
});

describe("sea type copy", () => {
  it("names and describes every type and group in both languages", () => {
    for (const copy of [en, pt]) {
      for (const id of SEA_TYPE_IDS) {
        const entry = (
          copy.type.names as Record<string, { name: string; blurb: string }>
        )[id];
        expect(entry?.name.length).toBeGreaterThan(0);
        expect(entry?.blurb.length).toBeGreaterThan(0);
        expect(entry?.name).not.toMatch(/\s/);
      }
      expect(Object.keys(copy.type.names).sort()).toEqual(
        [...SEA_TYPE_IDS].sort()
      );
      for (const group of SEA_GROUPS) {
        expect(copy.type.groups[group].name.length).toBeGreaterThan(0);
        expect(copy.type.groups[group].tagline.length).toBeGreaterThan(0);
      }
      for (const trait of TRAITS) {
        for (const pole of ["high", "low"] as const) {
          const word = copy.type.poles[trait][pole];
          expect(word.length).toBeGreaterThan(0);
        }
      }
      expect(copy.funDisclaimer.length).toBeGreaterThan(0);
    }
  });
});
