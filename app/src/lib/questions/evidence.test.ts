import { describe, expect, it } from "vitest";
import type { QuestionAnswer } from "@/lib/db/types";
import {
  choicePositions,
  DRIFT_MIN_ANSWERS,
  driftFromTest,
  leanPosition,
  leanBand,
  tallyEvidence,
} from "./evidence";

function answer(
  questionId: string,
  choiceId: string,
  patch: Partial<QuestionAnswer> = {}
): QuestionAnswer {
  return {
    id: `${questionId}-${choiceId}-${patch.answered_on ?? "d"}`,
    question_id: questionId,
    choice_id: choiceId,
    why: null,
    answered_on: "2026-11-13",
    in_crowd: true,
    created_at: "2026-11-13T10:00:00.000Z",
    updated_at: "2026-11-13T10:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...patch,
  };
}

describe("tallyEvidence", () => {
  it("is empty without answers", () => {
    const tally = tallyEvidence([]);
    expect(tally.openness).toEqual({ count: 0, lean: 0 });
  });

  it("averages the lean of choices on a trait", () => {
    // o1 a = +2 (strongest high), o1 d = -1 (low, weak): (1 + -0.5) / 2
    const tally = tallyEvidence([answer("o1", "a"), answer("o1", "d")]);
    expect(tally.openness.count).toBe(2);
    expect(tally.openness.lean).toBeCloseTo(0.25);
    expect(tally.neuroticism.count).toBe(0);
  });

  it("counts a neutral choice as an answer with no lean", () => {
    const tally = tallyEvidence([answer("o1", "c"), answer("o1", "a")]);
    expect(tally.openness.count).toBe(2);
    expect(tally.openness.lean).toBeCloseTo(0.5);
  });

  it("skips deleted answers and ids the bank no longer has", () => {
    const tally = tallyEvidence([
      answer("o1", "a", { deleted_at: "2026-11-14T00:00:00.000Z" }),
      answer("gone", "a"),
      answer("o1", "z"),
    ]);
    expect(tally.openness.count).toBe(0);
  });
});

describe("leanBand", () => {
  it("reads small leans as balanced", () => {
    expect(leanBand(0)).toBe("mid");
    expect(leanBand(0.24)).toBe("mid");
    expect(leanBand(0.25)).toBe("high");
    expect(leanBand(-0.25)).toBe("low");
  });
});

describe("driftFromTest", () => {
  it("says nothing before enough answers", () => {
    expect(
      driftFromTest({ count: DRIFT_MIN_ANSWERS - 1, lean: 1 }, 20)
    ).toBeNull();
  });

  it("speaks from the first answer", () => {
    expect(driftFromTest({ count: 1, lean: 0.5 }, 50)).toBe("higher");
  });

  it("says nothing when choices and test sit in the same band", () => {
    expect(driftFromTest({ count: 12, lean: 0.8 }, 80)).toBeNull();
    expect(driftFromTest({ count: 12, lean: 0 }, 50)).toBeNull();
  });

  it("names the direction when they differ", () => {
    expect(driftFromTest({ count: 10, lean: 0.8 }, 50)).toBe("higher");
    expect(driftFromTest({ count: 10, lean: -0.8 }, 50)).toBe("lower");
    expect(driftFromTest({ count: 10, lean: 0 }, 85)).toBe("lower");
    expect(driftFromTest({ count: 10, lean: 0 }, 15)).toBe("higher");
  });
});

describe("leanPosition", () => {
  it("maps a lean from -1..1 onto the bar, 0..100", () => {
    expect(leanPosition(-1)).toBe(0);
    expect(leanPosition(0)).toBe(50);
    expect(leanPosition(1)).toBe(100);
    expect(leanPosition(0.5)).toBe(75);
  });

  it("stays on the bar for a lean beyond the range", () => {
    expect(leanPosition(3)).toBe(100);
    expect(leanPosition(-3)).toBe(0);
  });
});

describe("choicePositions", () => {
  it("leaves out traits without enough answers", () => {
    const none = { count: 0, lean: 0 };
    const positions = choicePositions({
      openness: { count: 4, lean: 0.5 },
      conscientiousness: none,
      extraversion: { count: 1, lean: -1 },
      agreeableness: none,
      neuroticism: none,
    });
    expect(positions).toEqual({ openness: 75, extraversion: 0 });
  });
});
