import { describe, expect, it } from "vitest";
import { ITEMS, ITEM_COUNT, TRAITS, type PersonalityAnswers } from "./items";
import { countAnswered, nextUnansweredIndex, scoreSitting } from "./scoring";
import { band, gapDirection, level } from "./bands";
import { verifiedQuotes } from "./quotes";

function answerAll(value: number): PersonalityAnswers {
  return Object.fromEntries(ITEMS.map((item) => [item.id, value]));
}

/** Answers that agree with every trait as keyed: forward 5, reverse 1. */
function answerMax(): PersonalityAnswers {
  return Object.fromEntries(ITEMS.map((i) => [i.id, i.reverse ? 1 : 5]));
}

describe("instrument", () => {
  it("has 50 unique items, ten per trait", () => {
    expect(ITEM_COUNT).toBe(50);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(50);
    for (const trait of TRAITS) {
      expect(ITEMS.filter((i) => i.trait === trait)).toHaveLength(10);
    }
  });

  it("matches Goldberg's key: 5 reverse-keyed items in E, A, C, O; 2 in N", () => {
    const reversed = (trait: string) =>
      ITEMS.filter((i) => i.trait === trait && i.reverse).length;
    expect(reversed("extraversion")).toBe(5);
    expect(reversed("agreeableness")).toBe(4);
    expect(reversed("conscientiousness")).toBe(4);
    expect(reversed("neuroticism")).toBe(2);
    expect(reversed("openness")).toBe(3);
  });
});

describe("scoreSitting", () => {
  it("puts neutral answers at 50 on every trait", () => {
    const scores = scoreSitting(answerAll(3));
    expect(scores).not.toBeNull();
    for (const trait of TRAITS) expect(scores![trait]).toBe(50);
  });

  it("reverse-keys: agreeing with everything as keyed scores 100", () => {
    const scores = scoreSitting(answerMax());
    for (const trait of TRAITS) expect(scores![trait]).toBe(100);
  });

  it("reverse-keys: the opposite of keyed scores 0", () => {
    const flipped = Object.fromEntries(
      ITEMS.map((i) => [i.id, i.reverse ? 5 : 1])
    );
    const scores = scoreSitting(flipped);
    for (const trait of TRAITS) expect(scores![trait]).toBe(0);
  });

  it("answering 5 everywhere splits by how many items are reversed", () => {
    // Extraversion: 5 forward at 5, 5 reverse at 1 => mean 3 => 50.
    // Neuroticism: 8 forward at 5, 2 reverse at 1 => mean 4.2 => 80.
    const scores = scoreSitting(answerAll(5));
    expect(scores!.extraversion).toBe(50);
    expect(scores!.neuroticism).toBe(80);
  });

  it("refuses an incomplete sitting", () => {
    const answers = answerAll(3);
    delete answers.E1;
    expect(scoreSitting(answers)).toBeNull();
    expect(scoreSitting({})).toBeNull();
  });

  it("refuses out-of-range and non-integer answers", () => {
    expect(scoreSitting({ ...answerAll(3), E1: 6 })).toBeNull();
    expect(scoreSitting({ ...answerAll(3), E1: 0 })).toBeNull();
    expect(scoreSitting({ ...answerAll(3), E1: 2.5 })).toBeNull();
  });
});

describe("progress", () => {
  it("counts answered items and finds the next one", () => {
    expect(countAnswered({})).toBe(0);
    expect(nextUnansweredIndex({})).toBe(0);
    const first = ITEMS[0].id;
    expect(countAnswered({ [first]: 4, ZZ: 3 })).toBe(1);
    expect(nextUnansweredIndex({ [first]: 4 })).toBe(1);
    expect(nextUnansweredIndex(answerAll(3))).toBeNull();
  });
});

describe("bands", () => {
  it("bands scores", () => {
    expect(band(0)).toBe("low");
    expect(band(39)).toBe("low");
    expect(band(40)).toBe("mid");
    expect(band(59)).toBe("mid");
    expect(band(60)).toBe("high");
    expect(band(100)).toBe("high");
  });

  it("splits scores into fifths", () => {
    expect(level(0)).toBe("veryLow");
    expect(level(19)).toBe("veryLow");
    expect(level(20)).toBe("low");
    expect(level(39)).toBe("low");
    expect(level(40)).toBe("mid");
    expect(level(59)).toBe("mid");
    expect(level(60)).toBe("high");
    expect(level(79)).toBe("high");
    expect(level(80)).toBe("veryHigh");
    expect(level(100)).toBe("veryHigh");
  });

  it("reads the gap in either direction", () => {
    expect(gapDirection(50, 60)).toBe("close");
    expect(gapDirection(50, 65)).toBe("journalHigher");
    expect(gapDirection(65, 50)).toBe("journalLower");
    expect(gapDirection(50, 36)).toBe("close");
  });
});

describe("verifiedQuotes", () => {
  const days = [
    {
      date: "2026-11-01",
      title: "Long walk",
      text: "I made a plan and kept it.",
    },
    { date: "2026-11-02", title: "", text: "Called an old friend." },
  ];

  it("keeps only exact substrings of what was sent", () => {
    expect(
      verifiedQuotes(
        ["made a plan and kept it", "Made a plan", "Called an old friend."],
        days
      )
    ).toEqual(["made a plan and kept it", "Called an old friend."]);
  });

  it("drops invented, empty, non-string and repeated quotes", () => {
    expect(
      verifiedQuotes(
        ["never written", "", "  ", 4, "Long walk", "Long walk"],
        days
      )
    ).toEqual(["Long walk"]);
  });
});
