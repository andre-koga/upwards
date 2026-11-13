import { describe, expect, it } from "vitest";
import { parseCrowdResult, sharePercent } from "./crowd";

describe("parseCrowdResult", () => {
  it("reads a ready result", () => {
    expect(
      parseCrowdResult({ ready: true, total: 12, counts: { a: 7, b: 5 } })
    ).toEqual({ status: "ready", total: 12, counts: { a: 7, b: 5 } });
  });

  it("reads a result that is not ready as waiting, with no numbers", () => {
    expect(parseCrowdResult({ ready: false })).toEqual({ status: "waiting" });
  });

  it("totals the counts itself rather than trusting the reply", () => {
    expect(
      parseCrowdResult({ ready: true, total: 99, counts: { a: 6, b: 4 } })
    ).toEqual({ status: "ready", total: 10, counts: { a: 6, b: 4 } });
  });

  it("rejects replies it cannot trust", () => {
    expect(parseCrowdResult(null)).toBeNull();
    expect(parseCrowdResult({})).toBeNull();
    expect(parseCrowdResult({ ready: true })).toBeNull();
    expect(parseCrowdResult({ ready: true, counts: { a: -1 } })).toBeNull();
    expect(parseCrowdResult({ ready: true, counts: { a: 1.5 } })).toBeNull();
    expect(parseCrowdResult({ ready: true, counts: { a: "3" } })).toBeNull();
    expect(parseCrowdResult({ ready: true, counts: {} })).toBeNull();
  });
});

describe("sharePercent", () => {
  it("rounds to a whole percent", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(0, 10)).toBe(0);
  });

  it("is zero when nobody is counted", () => {
    expect(sharePercent(0, 0)).toBe(0);
  });
});
