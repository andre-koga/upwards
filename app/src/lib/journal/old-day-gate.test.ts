import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerOldDayPrompt,
  getOldDayPrompt,
  OLD_DAY_GRANT_MS,
  requestOldDayEdit,
  resetOldDayGate,
} from "./old-day-gate";

const NOW = new Date(2026, 5, 20, 12, 0);
const OLD = "2025-03-14";
const OTHER_OLD = "2025-03-15";

describe("requestOldDayEdit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    resetOldDayGate();
    vi.useRealTimers();
  });

  it("lets recent days through without a prompt", async () => {
    const decision = await requestOldDayEdit("2026-06-15", "x", NOW);
    expect(decision).toEqual({ confirmed: true, startsSession: false });
    expect(getOldDayPrompt()).toBeNull();
  });

  it("asks for an old day and resolves with the answer", async () => {
    const result = requestOldDayEdit(OLD, "Text removed", NOW);
    expect(getOldDayPrompt()).toMatchObject({
      date: OLD,
      summary: "Text removed",
    });
    answerOldDayPrompt(true);
    expect(await result).toEqual({ confirmed: true, startsSession: true });
    expect(getOldDayPrompt()).toBeNull();
  });

  it("does not ask again while the same day stays confirmed", async () => {
    const first = requestOldDayEdit(OLD, "a", NOW);
    answerOldDayPrompt(true);
    await first;

    const second = await requestOldDayEdit(OLD, "b", NOW);
    expect(second).toEqual({ confirmed: true, startsSession: false });
    expect(getOldDayPrompt()).toBeNull();
  });

  it("asks again after the grant expires", async () => {
    const first = requestOldDayEdit(OLD, "a", NOW);
    answerOldDayPrompt(true);
    await first;

    vi.setSystemTime(Date.now() + OLD_DAY_GRANT_MS + 1);
    const again = requestOldDayEdit(OLD, "b", NOW);
    expect(getOldDayPrompt()).not.toBeNull();
    answerOldDayPrompt(true);
    expect((await again).startsSession).toBe(true);
  });

  it("keeps the grant alive while the user keeps editing", async () => {
    const first = requestOldDayEdit(OLD, "a", NOW);
    answerOldDayPrompt(true);
    await first;

    for (let i = 0; i < 3; i += 1) {
      vi.setSystemTime(Date.now() + OLD_DAY_GRANT_MS - 1000);
      const next = await requestOldDayEdit(OLD, "more", NOW);
      expect(next.confirmed).toBe(true);
    }
    expect(getOldDayPrompt()).toBeNull();
  });

  it("does not grant anything when the user cancels", async () => {
    const cancelled = requestOldDayEdit(OLD, "a", NOW);
    answerOldDayPrompt(false);
    expect(await cancelled).toEqual({ confirmed: false, startsSession: false });

    const retry = requestOldDayEdit(OLD, "a", NOW);
    expect(getOldDayPrompt()).not.toBeNull();
    answerOldDayPrompt(false);
    await retry;
  });

  it("grants one day only", async () => {
    const first = requestOldDayEdit(OLD, "a", NOW);
    answerOldDayPrompt(true);
    await first;

    const other = requestOldDayEdit(OTHER_OLD, "b", NOW);
    expect(getOldDayPrompt()?.date).toBe(OTHER_OLD);
    answerOldDayPrompt(false);
    expect((await other).confirmed).toBe(false);
  });

  it("queues simultaneous requests for one day behind a single prompt", async () => {
    const a = requestOldDayEdit(OLD, "a", NOW);
    const b = requestOldDayEdit(OLD, "b", NOW);
    const c = requestOldDayEdit(OLD, "c", NOW);

    expect(getOldDayPrompt()?.summary).toBe("a");
    answerOldDayPrompt(true);

    const [first, second, third] = await Promise.all([a, b, c]);
    expect(first.startsSession).toBe(true);
    expect(second).toEqual({ confirmed: true, startsSession: false });
    expect(third).toEqual({ confirmed: true, startsSession: false });
    expect(getOldDayPrompt()).toBeNull();
  });

  it("declines every queued request for the day when the first is cancelled", async () => {
    const a = requestOldDayEdit(OLD, "a", NOW);
    const b = requestOldDayEdit(OLD, "b", NOW);

    answerOldDayPrompt(false);
    expect((await a).confirmed).toBe(false);

    // The second request now gets its own prompt; it is not silently approved.
    await vi.waitFor(() => expect(getOldDayPrompt()?.summary).toBe("b"));
    answerOldDayPrompt(false);
    expect((await b).confirmed).toBe(false);
  });
});
