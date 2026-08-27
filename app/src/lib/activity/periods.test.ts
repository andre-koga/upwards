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
      where: () => ({
        equals: () => ({
          filter: (predicate: (p: ActivityPeriod) => boolean) => ({
            toArray: async () => periods.filter(predicate),
          }),
        }),
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

const { closeOpenPeriods } = await import("./periods");

function makePeriod(overrides: Partial<ActivityPeriod> = {}): ActivityPeriod {
  return {
    id: "period-1",
    daily_entry_id: "entry-1",
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

  it("closes a real session without deleting it", async () => {
    periods.push(makePeriod({ start_time: "2026-08-01T11:00:00.000Z" }));

    await closeOpenPeriods("entry-1");

    expect(patches).toHaveLength(1);
    expect(patches[0].patch.end_time).toBe(nowIso);
    expect(patches[0].patch.deleted_at).toBeUndefined();
  });

  it("discards a genuine accidental tap under five seconds", async () => {
    periods.push(makePeriod({ start_time: "2026-08-01T11:59:58.000Z" }));

    await closeOpenPeriods("entry-1");

    expect(patches[0].patch.deleted_at).toBe(nowIso);
  });

  it("keeps an hour-long session when the clock has stepped backwards", async () => {
    // The bug: Date.now() is not monotonic. An NTP correction, a manual clock
    // change, or waking from sleep can put it behind start_time. The duration goes
    // negative, negative is < 5s, and a live session was tombstoned on every device.
    periods.push(makePeriod({ start_time: "2026-08-01T13:00:00.000Z" }));

    await closeOpenPeriods("entry-1");

    expect(patches).toHaveLength(1);
    expect(patches[0].patch.deleted_at).toBeUndefined();
    // Closed as zero-length rather than left inverted (end before start) or left
    // open to run concurrently with the next session.
    expect(patches[0].patch.end_time).toBe("2026-08-01T13:00:00.000Z");
  });

  it("keeps a short session that carries a note", async () => {
    periods.push(
      makePeriod({
        start_time: "2026-08-01T11:59:58.000Z",
        note: "finished the last page",
      })
    );

    await closeOpenPeriods("entry-1");

    expect(patches[0].patch.deleted_at).toBeUndefined();
  });

  it("still discards a short session whose note is only whitespace", async () => {
    periods.push(
      makePeriod({ start_time: "2026-08-01T11:59:58.000Z", note: "   " })
    );

    await closeOpenPeriods("entry-1");

    expect(patches[0].patch.deleted_at).toBe(nowIso);
  });

  it("discards exactly at the boundary below five seconds and keeps it at five", async () => {
    periods.push(
      makePeriod({ id: "just-under", start_time: "2026-08-01T11:59:55.001Z" }),
      makePeriod({ id: "exactly-five", start_time: "2026-08-01T11:59:55.000Z" })
    );

    await closeOpenPeriods("entry-1");

    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    expect(byId.get("just-under")?.deleted_at).toBe(nowIso);
    expect(byId.get("exactly-five")?.deleted_at).toBeUndefined();
  });
});
