import { describe, expect, it } from "vitest";
import en from "@/locales/en/questions.json";
import pt from "@/locales/pt/questions.json";
import { TRAITS } from "@/lib/personality/items";
import {
  QUESTIONS,
  QUESTIONS_PER_TRAIT,
  getQuestion,
  isValidChoice,
  questionsForTrait,
} from "./bank";

describe("question bank", () => {
  it("has unique ids", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has six questions for each trait", () => {
    for (const trait of TRAITS) {
      expect(questionsForTrait(trait)).toHaveLength(QUESTIONS_PER_TRAIT);
    }
    expect(QUESTIONS).toHaveLength(30);
  });

  it("gives every question three or four choices and a way to lean each way", () => {
    for (const q of QUESTIONS) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(q.choices.length).toBeLessThanOrEqual(4);
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(q.choices.length);
      const leans = q.choices.flatMap((c) => (c.lean ? [c.lean] : []));
      expect(leans.some((l) => l.direction === 1)).toBe(true);
      expect(leans.some((l) => l.direction === -1)).toBe(true);
      for (const lean of leans) expect(lean.trait).toBe(q.trait);
    }
  });

  it("words every question and every choice in both languages", () => {
    for (const copy of [en, pt]) {
      const words = copy.q as Record<string, Record<string, string>>;
      for (const q of QUESTIONS) {
        expect(words[q.id]?.prompt?.length).toBeGreaterThan(0);
        for (const c of q.choices) {
          expect(words[q.id]?.[c.id]?.length).toBeGreaterThan(0);
        }
        // No choice wording without a choice behind it.
        expect(Object.keys(words[q.id]).sort()).toEqual(
          ["prompt", ...q.choices.map((c) => c.id)].sort()
        );
      }
      expect(Object.keys(words).sort()).toEqual(
        QUESTIONS.map((q) => q.id).sort()
      );
    }
  });

  it("validates choices against the bank", () => {
    expect(getQuestion("o1")?.trait).toBe("openness");
    expect(getQuestion("zz")).toBeNull();
    expect(isValidChoice("o1", "a")).toBe(true);
    expect(isValidChoice("o3", "d")).toBe(false);
    expect(isValidChoice("zz", "a")).toBe(false);
  });
});
