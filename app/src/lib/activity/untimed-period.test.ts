import { describe, expect, it } from "vitest";
import { isUntimedPeriod } from "./untimed-period";

const iso = (hour: number, minute: number) =>
  new Date(2026, 5, 26, hour, minute, 0, 0).toISOString();

describe("isUntimedPeriod", () => {
  it("treats equal start and end as untimed", () => {
    expect(isUntimedPeriod(iso(8, 32), iso(8, 32))).toBe(true);
    expect(isUntimedPeriod(iso(8, 32), null)).toBe(false);
    expect(isUntimedPeriod(iso(8, 32), iso(8, 40))).toBe(false);
  });
});
