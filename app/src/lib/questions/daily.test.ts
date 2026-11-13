import { describe, expect, it } from "vitest";
import { QUESTIONS } from "./bank";
import { dayNumber, questionForDate } from "./daily";

function addDays(date: string, days: number): string {
  const d = new Date(Date.UTC(...(dayParts(date) as [number, number, number])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayParts(date: string): number[] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m - 1, d];
}

describe("dayNumber", () => {
  it("counts whole days and is not moved by the clock zone", () => {
    expect(dayNumber("1970-01-01")).toBe(0);
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2026-03-08")).toBe(dayNumber("2026-03-07") + 1);
  });
});

describe("questionForDate", () => {
  it("is the same for the same date", () => {
    expect(questionForDate("2026-11-13")).toBe(questionForDate("2026-11-13"));
  });

  it("asks every question once in each run of the bank's length", () => {
    for (const start of ["2026-01-01", "2026-11-13", "2027-02-20"]) {
      const asked = Array.from(
        { length: QUESTIONS.length },
        (_, i) => questionForDate(addDays(start, i)).id
      );
      // A window that straddles two cycles is not a permutation, so line the
      // window up with the cycle it starts in.
      const cycleStart = dayNumber(start) % QUESTIONS.length;
      const aligned = addDays(start, -cycleStart);
      const cycle = Array.from(
        { length: QUESTIONS.length },
        (_, i) => questionForDate(addDays(aligned, i)).id
      );
      expect(new Set(cycle).size).toBe(QUESTIONS.length);
      expect(asked.length).toBe(QUESTIONS.length);
    }
  });

  it("never asks about the same trait two days running, across cycles too", () => {
    let date = "2026-01-01";
    let previous = questionForDate(date).trait;
    for (let i = 0; i < QUESTIONS.length * 8; i += 1) {
      date = addDays(date, 1);
      const trait = questionForDate(date).trait;
      expect(trait).not.toBe(previous);
      previous = trait;
    }
  });

  it("covers all five traits within five days", () => {
    const traits = new Set(
      Array.from(
        { length: 5 },
        (_, i) => questionForDate(addDays("2026-06-01", i)).trait
      )
    );
    expect(traits.size).toBe(5);
  });
});
