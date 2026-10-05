import { describe, expect, it } from "vitest";
import type { ActivityPeriod } from "@/lib/db/types";
import {
  dayBoundsMs,
  sessionShareOfDay,
  sessionsOnDay,
} from "./period-day-utils";

// DST assertions need a zone that has DST. Node re-reads TZ when it changes.
process.env.TZ = "America/New_York";

const HOUR = 3_600_000;

function localMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function session(
  startMs: number,
  endMs: number | null,
  overrides: Partial<ActivityPeriod> = {}
): ActivityPeriod {
  const t = new Date(startMs).toISOString();
  return {
    id: "p",
    daily_entry_id: "e",
    activity_id: "a",
    start_time: t,
    end_time: endMs == null ? null : new Date(endMs).toISOString(),
    note: null,
    created_at: t,
    updated_at: t,
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("dayBoundsMs", () => {
  it("uses calendar arithmetic, so DST days are 23 or 25 hours", () => {
    const length = (date: string) => {
      const { startMs, endMs } = dayBoundsMs(date);
      return (endMs - startMs) / HOUR;
    };
    expect(length("2026-06-26")).toBe(24);
    expect(length("2026-03-08")).toBe(23); // spring forward
    expect(length("2026-11-01")).toBe(25); // fall back
  });
});

describe("sessionShareOfDay", () => {
  it("splits a cross-midnight session into shares that add up to its duration", () => {
    const start = localMs(2026, 6, 26, 23);
    const end = localMs(2026, 6, 27, 1);
    const first = sessionShareOfDay(start, end, "2026-06-26", end);
    const second = sessionShareOfDay(start, end, "2026-06-27", end);
    expect(first).toBe(HOUR);
    expect(second).toBe(HOUR);
    expect(first + second).toBe(end - start);
  });

  it("adds up across the spring-forward night too", () => {
    const start = localMs(2026, 3, 7, 23);
    const end = localMs(2026, 3, 8, 6);
    const shares =
      sessionShareOfDay(start, end, "2026-03-07", end) +
      sessionShareOfDay(start, end, "2026-03-08", end);
    expect(shares).toBe(end - start);
    expect(shares).toBe(6 * HOUR); // 02:00–03:00 does not exist
  });

  it("counts a running session up to now, and never goes negative", () => {
    const start = localMs(2026, 6, 26, 22);
    const now = localMs(2026, 6, 27, 2);
    expect(sessionShareOfDay(start, null, "2026-06-27", now)).toBe(2 * HOUR);
    expect(sessionShareOfDay(start, null, "2026-06-28", now)).toBe(0);
    expect(sessionShareOfDay(start, null, "2026-06-25", now)).toBe(0);
  });
});

describe("sessionsOnDay", () => {
  it("shows a session that crosses midnight on both days", () => {
    const crossing = session(localMs(2026, 6, 26, 23), localMs(2026, 6, 27, 1));
    const now = localMs(2026, 6, 27, 12);
    expect(sessionsOnDay([crossing], "2026-06-26", now)).toHaveLength(1);
    expect(sessionsOnDay([crossing], "2026-06-27", now)).toHaveLength(1);
    expect(sessionsOnDay([crossing], "2026-06-28", now)).toHaveLength(0);
  });

  it("shows a running session that started yesterday on today", () => {
    const running = session(localMs(2026, 6, 26, 23, 30), null);
    const now = localMs(2026, 6, 27, 0, 10);
    expect(sessionsOnDay([running], "2026-06-27", now)).toHaveLength(1);
  });

  it("keeps a session that ends exactly at midnight off the next day", () => {
    const ends = session(localMs(2026, 6, 26, 22), localMs(2026, 6, 27, 0));
    const now = localMs(2026, 6, 27, 12);
    expect(sessionsOnDay([ends], "2026-06-27", now)).toHaveLength(0);
  });

  it("places a legacy zero-length completion on the day of its instant", () => {
    const atMidnight = localMs(2026, 6, 26, 0);
    const now = localMs(2026, 6, 26, 12);
    const completion = session(atMidnight, atMidnight);
    expect(sessionsOnDay([completion], "2026-06-26", now)).toHaveLength(1);
    expect(sessionsOnDay([completion], "2026-06-25", now)).toHaveLength(0);
  });

  it("skips deleted sessions", () => {
    const deleted = session(localMs(2026, 6, 26, 9), localMs(2026, 6, 26, 10), {
      deleted_at: "2026-06-26T12:00:00.000Z",
    });
    expect(
      sessionsOnDay([deleted], "2026-06-26", localMs(2026, 6, 26, 12))
    ).toHaveLength(0);
  });
});
