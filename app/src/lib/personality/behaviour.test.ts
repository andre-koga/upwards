import { describe, expect, it } from "vitest";
import {
  behaviourSignal,
  type BehaviourInput,
  MIN_HISTORY_DAYS,
} from "./behaviour";

const TODAY = "2026-11-12";

function day(offset: number): string {
  const d = new Date(2026, 10, 12 - offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

function daily(
  date: string,
  counts: Record<string, number> | null = { a: 1 },
  isBreak = false
): BehaviourInput["daily"][number] {
  return {
    date,
    task_counts: counts,
    completion_times: null,
    is_break_day: isBreak,
    deleted_at: null,
  };
}

function empty(): BehaviourInput {
  return { periods: [], daily: [], journal: [] };
}

describe("behaviourSignal", () => {
  it("stays hidden with no data", () => {
    expect(behaviourSignal(empty(), TODAY)).toBeNull();
  });

  it("stays hidden until there is enough history", () => {
    const input = empty();
    for (let i = 0; i < 6; i++) input.daily.push(daily(day(i)));
    expect(MIN_HISTORY_DAYS).toBeGreaterThan(6);
    expect(behaviourSignal(input, TODAY)).toBeNull();
  });

  it("stays hidden with history but too few active days", () => {
    const input = empty();
    input.daily.push(daily(day(20)), daily(day(0)));
    expect(behaviourSignal(input, TODAY)).toBeNull();
  });

  it("counts the share of days with something logged", () => {
    const input = empty();
    // 15 of the last 30 days, every other day; a quiet record 29 days back.
    for (let i = 0; i < 30; i += 2) input.daily.push(daily(day(i)));
    input.daily.push(daily(day(29), null));
    const result = behaviourSignal(input, TODAY);
    expect(result?.detail.activeDays).toBe(15);
    expect(result?.detail.windowDays).toBe(30);
    expect(result?.conscientiousness).toBe(50);
  });

  it("does not count break days against the person", () => {
    const input = empty();
    for (let i = 0; i < 15; i++) input.daily.push(daily(day(i)));
    for (let i = 15; i < 30; i++) {
      input.daily.push(daily(day(i), null, true));
    }
    const result = behaviourSignal(input, TODAY);
    expect(result?.detail.countedDays).toBe(15);
    expect(result?.conscientiousness).toBe(100);
  });

  it("counts a written journal day and ignores an empty one", () => {
    const input = empty();
    for (let i = 0; i < 20; i++) {
      input.journal.push({
        entry_date: day(i),
        title: i % 2 === 0 ? "A day" : "  ",
        text_content: null,
        location: null,
        deleted_at: null,
      });
    }
    expect(behaviourSignal(input, TODAY)?.detail.activeDays).toBe(10);
  });

  it("ignores deleted rows", () => {
    const input = empty();
    for (let i = 0; i < 30; i++) {
      input.daily.push({ ...daily(day(i)), deleted_at: "2026-11-01" });
    }
    expect(behaviourSignal(input, TODAY)).toBeNull();
  });

  it("reads variety from different activities and places", () => {
    const input = empty();
    for (let i = 0; i < 20; i++) input.daily.push(daily(day(i), { a: 1 }));
    input.daily.push(daily(day(1), { b: 2, c: 1 }));
    input.periods.push({
      activity_id: "d",
      start_time: new Date(2026, 10, 10, 9).toISOString(),
      deleted_at: null,
    });
    const place = (city: string) => ({
      displayName: city,
      city,
      state: null,
      country: null,
      countryCode: null,
      lat: null,
      lon: null,
    });
    input.journal.push({
      entry_date: day(2),
      title: "Out",
      text_content: null,
      location: { locations: [place("Lisbon"), place("Porto")] },
      deleted_at: null,
    });
    input.journal.push({
      entry_date: day(3),
      title: "Back",
      text_content: null,
      location: { locations: [place("lisbon")] },
      deleted_at: null,
    });
    const result = behaviourSignal(input, TODAY);
    // Four activities (a, b, c, d) and two places (Lisbon, Porto).
    expect(result?.detail.activities).toBe(4);
    expect(result?.detail.places).toBe(2);
    expect(result?.openness).toBe(50);
  });

  it("caps variety at 100", () => {
    const input = empty();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 30; i++) counts[`a${i}`] = 1;
    for (let i = 0; i < 20; i++) input.daily.push(daily(day(i), counts));
    expect(behaviourSignal(input, TODAY)?.openness).toBe(100);
  });

  it("ignores days before the window", () => {
    const input = empty();
    for (let i = 40; i < 80; i++) input.daily.push(daily(day(i)));
    expect(behaviourSignal(input, TODAY)).toBeNull();
  });

  it("looks back only as far as the chosen range", () => {
    const input = empty();
    // Active every day for the last 14 days, then nothing until 60 days back.
    for (let i = 0; i < 14; i++) input.daily.push(daily(day(i)));
    for (let i = 55; i < 60; i++) input.daily.push(daily(day(i)));
    expect(behaviourSignal(input, TODAY, 14)?.conscientiousness).toBe(100);
    expect(behaviourSignal(input, TODAY, 30)?.conscientiousness).toBe(47);
    // 19 active days over the 60 days of history, inside the 90-day range.
    expect(behaviourSignal(input, TODAY, 90)?.detail.windowDays).toBe(60);
    expect(behaviourSignal(input, TODAY, 90)?.conscientiousness).toBe(32);
  });

  it("does not count days before the person started against them", () => {
    const input = empty();
    for (let i = 0; i < 20; i++) input.daily.push(daily(day(i)));
    const result = behaviourSignal(input, TODAY, 90);
    expect(result?.detail.windowDays).toBe(20);
    expect(result?.conscientiousness).toBe(100);
  });

  it("raises the bar for variety on a longer range", () => {
    const input = empty();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 8; i++) counts[`a${i}`] = 1;
    for (let i = 0; i < 20; i++) input.daily.push(daily(day(i), counts));
    expect(behaviourSignal(input, TODAY, 14)?.openness).toBe(100);
    expect(behaviourSignal(input, TODAY, 30)?.openness).toBe(67);
    expect(behaviourSignal(input, TODAY, 90)?.openness).toBe(40);
  });
});
