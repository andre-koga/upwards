import { describe, expect, it } from "vitest";
import { journalComparison, standoutTrait } from "./highlights";
import type { TraitScores } from "./items";

const flat = (over: Partial<TraitScores> = {}): TraitScores => ({
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
  ...over,
});

describe("highlights", () => {
  it("finds the standout trait", () => {
    expect(standoutTrait(flat({ agreeableness: 10, openness: 70 }))).toBe(
      "agreeableness"
    );
  });

  it("finds where the journal agrees and differs most", () => {
    const result = journalComparison(
      flat({ openness: 60, extraversion: 30 }),
      flat({ openness: 61, extraversion: 70 })
    );
    expect(result.closest).toBe("conscientiousness");
    expect(result.widest).toBe("extraversion");
  });

  it("reports no widest gap when the two agree", () => {
    expect(journalComparison(flat(), flat({ openness: 55 })).widest).toBeNull();
  });
});
