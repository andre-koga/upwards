import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

const row = {
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  synced_at: null,
  deleted_at: null,
};

describe("local schema after the model cutover", () => {
  it("opens at version 32", async () => {
    await db.open();
    expect(db.verno).toBe(32);
  });

  it("indexes archive state on activities and groups", async () => {
    await db.activityGroups.bulkAdd([
      {
        id: "g1",
        name: "A",
        color: null,
        order_index: null,
        is_archived: false,
        archived_at: null,
        ...row,
      },
      {
        id: "g2",
        name: "B",
        color: null,
        order_index: null,
        is_archived: false,
        archived_at: "2026-09-10T00:00:00.000Z",
        ...row,
      },
    ]);
    const archived = await db.activityGroups
      .where("archived_at")
      .above("")
      .toArray();
    expect(archived.map((g) => g.id)).toEqual(["g2"]);

    await db.activities.add({
      id: "a1",
      group_id: "g1",
      name: "Run",
      routine: "daily",
      completion_target: 1,
      is_archived: false,
      completed_at: null,
      archived_at: "2026-09-10T00:00:00.000Z",
      tracks_time: false,
      is_pinned: true,
      order_index: null,
      ...row,
    });
    const found = await db.activities.where("archived_at").above("").toArray();
    expect(found[0]).toMatchObject({
      id: "a1",
      tracks_time: false,
      is_pinned: true,
    });
  });

  it("finds sessions by time, with no daily entry", async () => {
    await db.activityPeriods.bulkAdd([
      {
        id: "p1",
        daily_entry_id: null,
        activity_id: "a1",
        start_time: "2026-09-01T08:00:00.000Z",
        end_time: "2026-09-01T09:00:00.000Z",
        note: null,
        ...row,
      },
      {
        id: "p2",
        daily_entry_id: null,
        activity_id: "a1",
        start_time: "2026-09-05T08:00:00.000Z",
        end_time: null,
        note: null,
        ...row,
      },
    ]);
    const inRange = await db.activityPeriods
      .where("start_time")
      .between("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z")
      .toArray();
    expect(inRange.map((p) => p.id)).toEqual(["p1"]);
  });
});
