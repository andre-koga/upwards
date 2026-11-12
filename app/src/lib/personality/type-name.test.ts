import { describe, expect, it } from "vitest";
import { journalComparison, standoutTrait } from "./highlights";
import type { TraitScores } from "./items";
import { typeName } from "./type-name";

const flat = (over: Partial<TraitScores> = {}): TraitScores => ({
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
  ...over,
});

describe("typeName", () => {
  it("is balanced when nothing stands out", () => {
    expect(typeName(flat())).toEqual({ kind: "balanced" });
    expect(typeName(flat({ openness: 58, neuroticism: 43 }))).toEqual({
      kind: "balanced",
    });
  });

  it("takes the adjective from the strongest trait and the noun from the next", () => {
    const name = typeName(flat({ openness: 90, conscientiousness: 25 }));
    if (name.kind !== "named") throw new Error("expected a name");
    expect(name.lead).toMatchObject({ trait: "openness", pole: "high" });
    expect(name.noun).toMatchObject({
      trait: "conscientiousness",
      pole: "low",
    });
    expect(name.defining).toHaveLength(2);
  });

  it("uses the lead trait for both words when no second trait stands out", () => {
    const name = typeName(flat({ extraversion: 15, agreeableness: 54 }));
    if (name.kind !== "named") throw new Error("expected a name");
    expect(name.lead).toMatchObject({ trait: "extraversion", pole: "low" });
    expect(name.noun.trait).toBe("extraversion");
    expect(name.defining).toHaveLength(1);
  });

  it("breaks ties by the usual trait order", () => {
    const name = typeName(flat({ openness: 70, neuroticism: 30 }));
    if (name.kind !== "named") throw new Error("expected a name");
    expect(name.lead.trait).toBe("openness");
    expect(name.noun.trait).toBe("neuroticism");
  });
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
