import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getCachedUserId: () => null }));
vi.mock("@/lib/sync/device-id", () => ({ getOrCreateDeviceId: () => "dev" }));

import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  ActivityStatusEvent,
  DailyEntry,
  RecurringMemo,
} from "@/lib/db/types";
import { emptyBackupTables } from "../format";
import {
  memoActivityId,
  migrateV5ToV6,
  routinesGroupId,
  type BackupDocumentV5,
} from "./v5-to-v6";

const EXPORTED = "2026-10-01T12:00:00.000Z";
const USER = "11111111-1111-4111-8111-111111111111";
const row = {
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
  synced_at: null,
  deleted_at: null,
};

function doc(
  patch: Partial<BackupDocumentV5["tables"]> = {}
): BackupDocumentV5 {
  return {
    format: "upwards-backup",
    format_version: 5,
    exported_at: EXPORTED,
    source_user_key: USER,
    settings: null,
    media: [],
    tables: {
      ...emptyBackupTables(),
      recurringMemos: [],
      activityStatusEvents: [],
      groupStatusEvents: [],
      ...patch,
    },
  };
}

const group = (p: Partial<ActivityGroup> = {}): ActivityGroup => ({
  id: "g1",
  name: "Health",
  emoji: null,
  color: null,
  order_index: null,
  is_archived: false,
  archived_at: null,
  ...row,
  ...p,
});

const activity = (p: Partial<Activity> = {}): Activity => ({
  id: "a1",
  group_id: "g1",
  name: "Run",
  routine: "daily",
  completion_target: 1,
  is_archived: false,
  completed_at: null,
  archived_at: null,
  tracks_time: true,
  is_pinned: false,
  order_index: null,
  ...row,
  ...p,
});

const event = (p: Partial<ActivityStatusEvent>): ActivityStatusEvent => ({
  id: "e",
  entity_id: "a1",
  status_type: "archived",
  next_value: true,
  effective_at: "2026-06-11T00:00:00.000Z",
  ...row,
  ...p,
});

const entry = (p: Partial<DailyEntry> = {}): DailyEntry => ({
  id: "d1",
  date: "2026-09-01",
  task_counts: {},
  paused_task_ids: [],
  is_break_day: false,
  completion_notes: {},
  completion_times: {},
  ...row,
  ...p,
});

const period = (p: Partial<ActivityPeriod> = {}): ActivityPeriod => ({
  id: "p1",
  daily_entry_id: "d1",
  activity_id: "a1",
  start_time: "2026-09-01T08:00:00.000Z",
  end_time: "2026-09-01T09:00:00.000Z",
  note: null,
  ...row,
  ...p,
});

const memo = (p: Partial<RecurringMemo> = {}): RecurringMemo => ({
  id: "m1",
  title: "Vitamins",
  routine: "daily",
  is_pinned: false,
  is_enabled: true,
  ...row,
  ...p,
});

describe("lifecycle", () => {
  it("uses the latest archive event for the date, not the first", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity({ is_archived: true })],
        activityStatusEvents: [
          event({
            id: "old",
            effective_at: "2026-03-01T00:00:00.000Z",
            created_at: "2026-03-01T00:00:00.000Z",
          }),
          event({
            id: "new",
            effective_at: "2026-06-11T00:00:00.000Z",
            created_at: "2026-06-10T00:00:00.000Z",
          }),
        ],
      })
    );
    expect(out.tables.activities[0].archived_at).toBe(
      "2026-06-11T00:00:00.000Z"
    );
  });

  it("falls back to completed_at, then updated_at, with no event", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [
          activity({
            id: "x",
            is_archived: true,
            completed_at: "2026-04-04T00:00:00.000Z",
          }),
          activity({ id: "y", name: "Y", is_archived: true }),
        ],
      })
    );
    const byId = new Map(out.tables.activities.map((a) => [a.id, a]));
    expect(byId.get("x")?.archived_at).toBe("2026-04-04T00:00:00.000Z");
    expect(byId.get("y")?.archived_at).toBe(row.updated_at);
  });

  it("counts a legacy 'completed' status as archived", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity({ is_archived: true })],
        activityStatusEvents: [event({ status_type: "completed" })],
      })
    );
    expect(out.tables.activities[0].archived_at).toBe(
      "2026-06-11T00:00:00.000Z"
    );
  });

  it("trusts the row flag over a stale event: a restored item stays active", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity({ is_archived: false })],
        activityStatusEvents: [event({})],
      })
    );
    expect(out.tables.activities[0].archived_at).toBeNull();
  });

  it("deletes when the last deleted event says so, as of the export", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity()],
        activityStatusEvents: [
          event({ status_type: "deleted", next_value: true }),
        ],
      })
    );
    expect(out.tables.activities[0].deleted_at).toBe(EXPORTED);
  });

  it("does not delete when a later event undid the delete", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity()],
        activityStatusEvents: [
          event({
            id: "1",
            status_type: "deleted",
            next_value: true,
            created_at: "2026-05-01T00:00:00.000Z",
          }),
          event({
            id: "2",
            status_type: "deleted",
            next_value: false,
            created_at: "2026-05-02T00:00:00.000Z",
          }),
        ],
      })
    );
    expect(out.tables.activities[0].deleted_at).toBeNull();
  });
});

describe("unnamed group activities", () => {
  it("falls back to a '· general' name when the group's name is taken", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group({ name: "Health" })],
        activities: [
          activity({ id: "named", name: "health" }),
          activity({
            id: "hidden",
            name: null as unknown as string,
            routine: null,
          }),
        ],
        activityPeriods: [period({ activity_id: "hidden" })],
        dailyEntries: [entry()],
      })
    );
    const hidden = out.tables.activities.find((a) => a.id === "hidden")!;
    expect(hidden.name).toBe("Health · general");
    expect(hidden.deleted_at).toBeNull();
  });

  it("keeps one that only has counts, notes or completion times on some day", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [
          activity({ id: "hidden", name: null as unknown as string }),
        ],
        dailyEntries: [entry({ completion_notes: { hidden: "hi" } })],
      })
    );
    expect(out.tables.activities[0].deleted_at).toBeNull();
  });

  it("deletes one that holds nothing, but a deleted session does not count as data", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [
          activity({ id: "hidden", name: null as unknown as string }),
        ],
        activityPeriods: [
          period({
            activity_id: "hidden",
            deleted_at: "2026-09-02T00:00:00.000Z",
          }),
        ],
      })
    );
    expect(out.tables.activities[0].deleted_at).toBe(EXPORTED);
  });
});

describe("recurring memos", () => {
  it("adds no Routines group when there are no memos", () => {
    const out = migrateV5ToV6(doc({ activityGroups: [group()] }));
    expect(out.tables.activityGroups).toHaveLength(1);
  });

  it("converts every memo, including deleted and disabled ones", () => {
    const out = migrateV5ToV6(
      doc({
        recurringMemos: [
          memo({ id: "on" }),
          memo({
            id: "off",
            is_enabled: false,
            updated_at: "2026-07-07T00:00:00.000Z",
          }),
          memo({ id: "gone", deleted_at: "2026-08-08T00:00:00.000Z" }),
        ],
      })
    );
    const byId = new Map(out.tables.activities.map((a) => [a.id, a]));
    expect(byId.get(memoActivityId("on"))?.archived_at).toBeNull();
    expect(byId.get(memoActivityId("off"))?.archived_at).toBe(
      "2026-07-07T00:00:00.000Z"
    );
    expect(byId.get(memoActivityId("gone"))?.deleted_at).toBe(
      "2026-08-08T00:00:00.000Z"
    );
    expect(
      out.tables.activities.every((a) => a.group_id === routinesGroupId(USER))
    ).toBe(true);
  });

  it("derives the same ids the server did, so they never collide with anything else", () => {
    expect(memoActivityId("m1")).toBe(memoActivityId("m1"));
    expect(memoActivityId("m1")).not.toBe(memoActivityId("m2"));
    expect(routinesGroupId(USER)).not.toBe(
      routinesGroupId("22222222-2222-4222-8222-222222222222")
    );
  });
});

describe("sessions", () => {
  it("ignores an instant when the day's count did not reach the target", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity({ completion_target: 3 })],
        dailyEntries: [entry({ task_counts: { a1: 1 } })],
        activityPeriods: [
          period({
            start_time: "2026-09-01T08:15:00.000Z",
            end_time: "2026-09-01T08:15:00.000Z",
            note: "ignored",
          }),
        ],
      })
    );
    expect(out.tables.dailyEntries[0].completion_times).toEqual({});
    expect(out.tables.dailyEntries[0].completion_notes).toEqual({});
  });

  it("never overwrites a time the day already has", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity()],
        dailyEntries: [
          entry({
            task_counts: { a1: 1 },
            completion_times: { a1: "2026-09-01T07:00:00.000Z" },
          }),
        ],
        activityPeriods: [
          period({
            start_time: "2026-09-01T08:15:00.000Z",
            end_time: "2026-09-01T08:15:00.000Z",
          }),
        ],
      })
    );
    expect(out.tables.dailyEntries[0].completion_times).toEqual({
      a1: "2026-09-01T07:00:00.000Z",
    });
  });

  it("lets the latest of several instants win", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity()],
        dailyEntries: [entry({ task_counts: { a1: 1 } })],
        activityPeriods: [
          period({
            id: "early",
            start_time: "2026-09-01T06:00:00.000Z",
            end_time: "2026-09-01T06:00:00.000Z",
          }),
          period({
            id: "late",
            start_time: "2026-09-01T09:30:00.000Z",
            end_time: "2026-09-01T09:30:00.000Z",
          }),
        ],
      })
    );
    expect(out.tables.dailyEntries[0].completion_times).toEqual({
      a1: "2026-09-01T09:30:00.000Z",
    });
  });

  it("leaves a session that ran under a day alone, and closes one that ran over", () => {
    const out = migrateV5ToV6(
      doc({
        activityGroups: [group()],
        activities: [activity()],
        activityPeriods: [
          period({
            id: "fresh",
            end_time: null,
            start_time: "2026-10-01T10:00:00.000Z",
          }),
          period({
            id: "stale",
            end_time: null,
            start_time: "2026-09-20T10:00:00.000Z",
          }),
        ],
      })
    );
    const byId = new Map(out.tables.activityPeriods.map((p) => [p.id, p]));
    expect(byId.get("fresh")?.end_time).toBeNull();
    expect(byId.get("stale")?.end_time).toBe("2026-09-20T11:00:00.000Z");
  });
});

describe("the conversion as a whole", () => {
  it("is deterministic, so converting a file twice gives the same rows", () => {
    const input = () =>
      doc({
        activityGroups: [group()],
        activities: [activity({ is_archived: true })],
        recurringMemos: [memo()],
        activityStatusEvents: [event({})],
      });
    expect(migrateV5ToV6(input())).toEqual(migrateV5ToV6(input()));
  });

  it("produces a v6 file with none of the retired tables", () => {
    const out = migrateV5ToV6(doc({ activityGroups: [group()] }));
    expect(out.format_version).toBe(6);
    expect("recurringMemos" in out.tables).toBe(false);
    expect("activityStatusEvents" in out.tables).toBe(false);
    expect("groupStatusEvents" in out.tables).toBe(false);
  });

  it("does not modify the file it was given", () => {
    const input = doc({
      activityGroups: [group()],
      activities: [activity()],
      dailyEntries: [entry({ task_counts: { a1: 1 } })],
      activityPeriods: [
        period({
          start_time: "2026-09-01T08:15:00.000Z",
          end_time: "2026-09-01T08:15:00.000Z",
        }),
      ],
    });
    const before = JSON.stringify(input);
    migrateV5ToV6(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
