import { describe, expect, it } from "vitest";
import {
  formatClockTime,
  resolveSessionSpan,
  sessionDateRange,
} from "./time-utils";

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

describe("resolveSessionSpan", () => {
  it("keeps a same-day session on its date", () => {
    const span = resolveSessionSpan("2026-06-26", "09:00:00", "10:30:00");
    expect(span.startMs).toBe(new Date(2026, 5, 26, 9, 0).getTime());
    expect(span.endMs).toBe(new Date(2026, 5, 26, 10, 30).getTime());
    expect(sessionDateRange(span.startMs, span.endMs)).toEqual({
      startDate: "2026-06-26",
      endDate: "2026-06-26",
    });
  });

  it("ends the next day when the end time is at or before the start", () => {
    const span = resolveSessionSpan("2026-06-26", "23:00:00", "01:00:00");
    expect(span.endMs).toBe(new Date(2026, 5, 27, 1, 0).getTime());
    expect(sessionDateRange(span.startMs, span.endMs)).toEqual({
      startDate: "2026-06-26",
      endDate: "2026-06-27",
    });
  });

  it("does not count a session ending exactly at midnight as the next day", () => {
    const span = resolveSessionSpan("2026-06-26", "22:00:00", "00:00:00");
    expect(sessionDateRange(span.startMs, span.endMs).endDate).toBe(
      "2026-06-26"
    );
  });
});
