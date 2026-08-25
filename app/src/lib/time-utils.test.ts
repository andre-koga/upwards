import { describe, expect, it } from "vitest";
import { formatClockTime } from "./time-utils";

describe("formatClockTime", () => {
  it("formats clock time with minutes and AM/PM, without seconds", () => {
    expect(formatClockTime(new Date(2026, 5, 26, 8, 32, 5).toISOString())).toBe(
      "08:32 AM"
    );
    expect(formatClockTime(new Date(2026, 5, 26, 15, 4, 9).toISOString())).toBe(
      "03:04 PM"
    );
    expect(formatClockTime(new Date(2026, 5, 26, 0, 0, 0).toISOString())).toBe(
      "12:00 AM"
    );
    expect(formatClockTime(new Date(2026, 5, 26, 12, 0, 0).toISOString())).toBe(
      "12:00 PM"
    );
  });
});
