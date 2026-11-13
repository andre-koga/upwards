import { describe, expect, it } from "vitest";
import { computeStreaks } from "./streak";

describe("computeStreaks", () => {
  it("is zero with no answers", () => {
    expect(computeStreaks([], "2026-11-13")).toEqual({
      current: 0,
      best: 0,
      answeredToday: false,
    });
  });

  it("counts days in a row ending today", () => {
    const result = computeStreaks(
      ["2026-11-11", "2026-11-12", "2026-11-13"],
      "2026-11-13"
    );
    expect(result).toEqual({ current: 3, best: 3, answeredToday: true });
  });

  it("keeps the streak alive until the missed day has ended", () => {
    const result = computeStreaks(["2026-11-11", "2026-11-12"], "2026-11-13");
    expect(result).toEqual({ current: 2, best: 2, answeredToday: false });
  });

  it("breaks after a full missed day but remembers the best run", () => {
    const result = computeStreaks(
      ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-12"],
      "2026-11-14"
    );
    expect(result.current).toBe(0);
    expect(result.best).toBe(3);
  });

  it("counts a gap of one day as a break", () => {
    const result = computeStreaks(["2026-11-10", "2026-11-12"], "2026-11-12");
    expect(result).toMatchObject({ current: 1, best: 1 });
  });

  it("crosses month, year and clock-change boundaries", () => {
    const result = computeStreaks(
      ["2026-12-30", "2026-12-31", "2027-01-01", "2027-03-14"],
      "2027-01-01"
    );
    expect(result).toMatchObject({ current: 3, best: 3 });
    const dst = computeStreaks(
      ["2026-03-07", "2026-03-08", "2026-03-09"],
      "2026-03-09"
    );
    expect(dst.current).toBe(3);
  });

  it("ignores duplicate dates", () => {
    const result = computeStreaks(["2026-11-13", "2026-11-13"], "2026-11-13");
    expect(result).toMatchObject({ current: 1, best: 1 });
  });
});
