import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityPeriod } from "@/lib/db/types";

/**
 * closeOpenPeriods soft-deletes short sessions, and that tombstone is pushed to
 * every device. In production 88 of 143 deleted activity_periods were under five
 * seconds — this function's signature, not user deletes — so the discard test has
 * to be exact.
 */

const periods: ActivityPeriod[] = [];
const patches: Array<{ id: string; patch: Partial<ActivityPeriod> }> = [];
let nowIso = "2026-08-01T12:00:00.000Z";

vi.mock("@/lib/db", () => ({
  db: {
    activityPeriods: {
      filter: (predicate: (p: ActivityPeriod) => boolean) => ({
        toArray: async () => periods.filter(predicate),
      }),
    },
  },
  now: () => nowIso,
}));

vi.mock("@/lib/sync/mutate-synced", () => ({
  patchTimedPeriod: async (id: string, patch: Partial<ActivityPeriod>) => {
    patches.push({ id, patch });
  },
}));

const { closeOpenPeriods, fetchActivityPeriodsForDay } =
  await import("./periods");

function makePeriod(overrides: Partial<ActivityPeriod> = {}): ActivityPeriod {
  return {
    id: "period-1",
    daily_entry_id: null,
    activity_id: "activity-1",
    start_time: "2026-08-01T11:00:00.000Z",
    end_time: null,
    note: null,
    created_at: "2026-08-01T11:00:00.000Z",
    updated_at: "2026-08-01T11:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("closeOpenPeriods", () => {
  beforeEach(() => {
    periods.length = 0;
    patches.length = 0;
    nowIso = "2026-08-01T12:00:00.000Z";
  });

  it("closes a session left open from an earlier day, since sessions belong to no day", async () => {
    periods.push(
      makePeriod({
        start_time: "2026-07-30T22:00:00.000Z",
      })
    );

    await closeOpenPeriods();

    expect(patches).toHaveLength(1);
    expect(patches[0].patch.end_time).toBe(nowIso);
  });

  it("leaves already-closed and deleted sessions alone", async () => {
    periods.push(
      makePeriod({ id: "closed", end_time: "2026-08-01T11:30:00.000Z" }),
      makePeriod({ id: "deleted", deleted_at: "2026-08-01T11:10:00.000Z" })
    );

    await closeOpenPeriods();

    expect(patches).toHaveLength(0);
  });

  it("closes a real session without deleting it", async () => {
    periods.push(makePeriod({ start_time: "2026-08-01T11:00:00.000Z" }));

    await closeOpenPeriods();

    expect(patches).toHaveLength(1);
    expect(patches[0].patch.end_time).toBe(nowIso);
    expect(patches[0].patch.deleted_at).toBeUndefined();
  });

  it("discards a genuine accidental tap under five seconds", async () => {
    periods.push(makePeriod({ start_time: "2026-08-01T11:59:58.000Z" }));

    await closeOpenPeriods();

    expect(patches[0].patch.deleted_at).toBe(nowIso);
  });

  it("keeps an hour-long session when the clock has stepped backwards", async () => {
    // The bug: Date.now() is not monotonic. An NTP correction, a manual clock
    // change, or waking from sleep can put it behind start_time. The duration goes
    // negative, negative is < 5s, and a live session was tombstoned on every device.
    periods.push(makePeriod({ start_time: "2026-08-01T13:00:00.000Z" }));

    await closeOpenPeriods();

    expect(patches).toHaveLength(1);
    expect(patches[0].patch.deleted_at).toBeUndefined();
    // Closed one second after it started: not left inverted (end before start),
    // not left open to run alongside the next session, and not zero-length (that
    // shape no longer exists).
    expect(patches[0].patch.end_time).toBe("2026-08-01T13:00:01.000Z");
  });

  it("keeps a short session that carries a note", async () => {
    periods.push(
      makePeriod({
        start_time: "2026-08-01T11:59:58.000Z",
        note: "finished the last page",
      })
    );

    await closeOpenPeriods();

    expect(patches[0].patch.deleted_at).toBeUndefined();
  });

  it("still discards a short session whose note is only whitespace", async () => {
    periods.push(
      makePeriod({ start_time: "2026-08-01T11:59:58.000Z", note: "   " })
    );

    await closeOpenPeriods();

    expect(patches[0].patch.deleted_at).toBe(nowIso);
  });

  it("discards exactly at the boundary below five seconds and keeps it at five", async () => {
    periods.push(
      makePeriod({ id: "just-under", start_time: "2026-08-01T11:59:55.001Z" }),
      makePeriod({ id: "exactly-five", start_time: "2026-08-01T11:59:55.000Z" })
    );

    await closeOpenPeriods();

    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    expect(byId.get("just-under")?.deleted_at).toBe(nowIso);
    expect(byId.get("exactly-five")?.deleted_at).toBeUndefined();
  });
});

describe("fetchActivityPeriodsForDay", () => {
  // Local midnight-based so the test holds in any timezone the suite runs in.
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 7, day, hour, minute).toISOString();

  beforeEach(() => {
    periods.length = 0;
  });

  it("finds a session by its own times, with no daily entry anywhere", async () => {
    periods.push(
      makePeriod({
        id: "morning",
        daily_entry_id: null,
        start_time: at(5, 9),
        end_time: at(5, 10),
      })
    );

    const found = await fetchActivityPeriodsForDay("2026-08-05");

    expect(found.map((p) => p.id)).toEqual(["morning"]);
  });

  it("shows a session that crosses midnight on both days", async () => {
    periods.push(
      makePeriod({
        id: "late",
        start_time: at(5, 23, 30),
        end_time: at(6, 0, 45),
      })
    );

    expect((await fetchActivityPeriodsForDay("2026-08-05")).length).toBe(1);
    expect((await fetchActivityPeriodsForDay("2026-08-06")).length).toBe(1);
    expect((await fetchActivityPeriodsForDay("2026-08-04")).length).toBe(0);
    expect((await fetchActivityPeriodsForDay("2026-08-07")).length).toBe(0);
  });

  it("excludes deleted sessions and sessions on other days", async () => {
    periods.push(
      makePeriod({
        id: "gone",
        start_time: at(5, 9),
        end_time: at(5, 10),
        deleted_at: at(5, 11),
      }),
      makePeriod({
        id: "other-day",
        start_time: at(9, 9),
        end_time: at(9, 10),
      })
    );

    expect(await fetchActivityPeriodsForDay("2026-08-05")).toEqual([]);
  });

  it("returns sessions in start order", async () => {
    periods.push(
      makePeriod({ id: "b", start_time: at(5, 14), end_time: at(5, 15) }),
      makePeriod({ id: "a", start_time: at(5, 8), end_time: at(5, 9) })
    );

    const found = await fetchActivityPeriodsForDay("2026-08-05");

    expect(found.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
