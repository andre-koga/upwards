import { describe, expect, it } from "vitest";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  describeActivityForCompass,
  describeGroupForCompass,
  goalEvidence,
  type EvidenceActivity,
  type EvidenceGroup,
  type EvidenceWeek,
} from "./goal-evidence";

function activity(
  patch: Partial<EvidenceActivity> & Pick<EvidenceActivity, "id">
): EvidenceActivity {
  return {
    groupId: "g1",
    name: "Stretch",
    archived: false,
    deleted: false,
    avoid: false,
    ...patch,
  };
}

function group(
  patch: Partial<EvidenceGroup> & Pick<EvidenceGroup, "id">
): EvidenceGroup {
  return { name: "Body", archived: false, deleted: false, ...patch };
}

function week(
  patch: Partial<EvidenceWeek> & Pick<EvidenceWeek, "activityId">
): EvidenceWeek {
  return { daysDone: 4, daysActive: 7, measure: "done", ...patch };
}

describe("goalEvidence", () => {
  it("gives an unlinked goal no number", () => {
    expect(
      goalEvidence(
        { activity_id: null, group_id: null },
        [activity({ id: "a1" })],
        [],
        [week({ activityId: "a1" })]
      )
    ).toEqual({ kind: "unlinked" });
  });

  it("reports a habit's own week, and a time-only week as tracked", () => {
    expect(
      goalEvidence(
        { activity_id: "a1", group_id: null },
        [activity({ id: "a1" })],
        [],
        [week({ activityId: "a1", daysDone: 4, daysActive: 7 })]
      )
    ).toEqual({
      kind: "record",
      lines: [{ name: "Stretch", daysDone: 4, daysActive: 7, measure: "done" }],
    });

    expect(
      goalEvidence(
        { activity_id: "a1", group_id: null },
        [activity({ id: "a1", name: "Piano" })],
        [],
        [week({ activityId: "a1", daysDone: 2, measure: "tracked" })]
      ).kind
    ).toBe("record");
  });

  it("says an archived or deleted habit is archived and keeps no number", () => {
    expect(
      goalEvidence(
        { activity_id: "a1", group_id: null },
        [activity({ id: "a1", archived: true })],
        [],
        [week({ activityId: "a1" })]
      )
    ).toEqual({ kind: "archived", subject: "habit", name: "Stretch" });

    expect(
      goalEvidence(
        { activity_id: "a1", group_id: null },
        [activity({ id: "a1", deleted: true })],
        [],
        []
      ).kind
    ).toBe("archived");
  });

  it("does not invent a count for an avoid habit or a missing week", () => {
    expect(
      goalEvidence(
        { activity_id: "a1", group_id: null },
        [activity({ id: "a1", avoid: true })],
        [],
        []
      )
    ).toEqual({ kind: "uncounted", name: "Stretch" });

    expect(
      goalEvidence({ activity_id: "gone", group_id: null }, [], [], [])
    ).toEqual({ kind: "missing", subject: "habit" });
  });

  it("lists each countable habit in a group, by name, with no combined score", () => {
    const evidence = goalEvidence(
      { activity_id: null, group_id: "g1" },
      [
        activity({ id: "b", name: "Run" }),
        activity({ id: "a", name: "Stretch" }),
        activity({ id: "c", name: "Sugar", avoid: true }),
        activity({ id: "d", name: "Old", archived: true }),
      ],
      [group({ id: "g1" })],
      [
        week({ activityId: "b", daysDone: 1 }),
        week({ activityId: "a", daysDone: 4 }),
        week({ activityId: "c", daysDone: 7 }),
      ]
    );
    expect(evidence).toEqual({
      kind: "record",
      lines: [
        { name: "Run", daysDone: 1, daysActive: 7, measure: "done" },
        { name: "Stretch", daysDone: 4, daysActive: 7, measure: "done" },
      ],
    });
  });

  it("says an archived group is archived, and a group with nothing to count stays quiet", () => {
    expect(
      goalEvidence(
        { activity_id: null, group_id: "g1" },
        [],
        [group({ id: "g1", archived: true, name: "Body" })],
        []
      )
    ).toEqual({ kind: "archived", subject: "group", name: "Body" });

    expect(
      goalEvidence(
        { activity_id: null, group_id: "g1" },
        [activity({ id: "a1", avoid: true })],
        [group({ id: "g1" })],
        []
      )
    ).toEqual({ kind: "uncounted", name: "Body" });

    expect(
      goalEvidence({ activity_id: null, group_id: "missing" }, [], [], [])
    ).toEqual({ kind: "missing", subject: "group" });
  });

  it("reads a goal that links both as the habit, not a blend", () => {
    const evidence = goalEvidence(
      { activity_id: "a1", group_id: "g1" },
      [activity({ id: "a1", name: "Stretch" })],
      [group({ id: "g1", name: "Body" })],
      [week({ activityId: "a1", daysDone: 3 })]
    );
    expect(evidence).toMatchObject({
      kind: "record",
      lines: [expect.objectContaining({ name: "Stretch", daysDone: 3 })],
    });
  });
});

describe("describeActivityForCompass", () => {
  const activityRow = {
    id: "a1",
    group_id: "g1",
    name: null,
    routine: "daily",
    archived_at: null,
    deleted_at: null,
  } satisfies Pick<
    Activity,
    "id" | "group_id" | "name" | "routine" | "archived_at" | "deleted_at"
  >;

  const groupRow = {
    name: "Body",
    archived_at: "2026-10-01T00:00:00.000Z",
    deleted_at: null,
  } satisfies Pick<ActivityGroup, "name" | "archived_at" | "deleted_at">;

  it("uses the group name when the activity has none, and inherits the group's archive", () => {
    expect(describeActivityForCompass(activityRow, groupRow)).toMatchObject({
      name: "Body",
      archived: true,
      deleted: false,
      avoid: false,
    });
  });

  it("marks an avoid habit", () => {
    expect(
      describeActivityForCompass(
        { ...activityRow, name: "Sugar", routine: "never" },
        { ...groupRow, archived_at: null }
      ).avoid
    ).toBe(true);
  });
});

describe("describeGroupForCompass", () => {
  it("trims the name and reads the lifecycle timestamps", () => {
    expect(
      describeGroupForCompass({
        id: "g1",
        name: " Body ",
        archived_at: null,
        deleted_at: "2026-10-02T00:00:00.000Z",
      })
    ).toEqual({
      id: "g1",
      name: "Body",
      archived: false,
      deleted: true,
    });
  });
});
