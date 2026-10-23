import type { Activity, ActivityGroup, CompassItem } from "@/lib/db/types";

/**
 * What a goal may show under its words (product-scope.md B5b-2).
 *
 * The line is evidence from the same week Home uses. It is never a percentage,
 * a bar, or a score. An unlinked goal has no number. An archived or deleted
 * link keeps the goal's words and says the link is archived.
 */

export interface EvidenceActivity {
  id: string;
  groupId: string;
  name: string;
  archived: boolean;
  deleted: boolean;
  /** Avoid habits are not counted as done or missed. */
  avoid: boolean;
}

export interface EvidenceGroup {
  id: string;
  name: string;
  archived: boolean;
  deleted: boolean;
}

export interface EvidenceWeek {
  activityId: string;
  daysDone: number;
  daysActive: number;
  /** A habit was done; a time-only activity was tracked. */
  measure: "done" | "tracked";
}

export interface EvidenceLine {
  name: string;
  daysDone: number;
  daysActive: number;
  measure: "done" | "tracked";
}

export type GoalEvidence =
  | { kind: "unlinked" }
  | { kind: "archived"; subject: "habit" | "group"; name: string }
  | { kind: "missing"; subject: "habit" | "group" }
  | { kind: "uncounted"; name: string }
  | { kind: "record"; lines: EvidenceLine[] };

export function describeGroupForCompass(
  group: Pick<ActivityGroup, "id" | "name" | "archived_at" | "deleted_at">
): EvidenceGroup {
  return {
    id: group.id,
    name: group.name.trim(),
    archived: group.archived_at != null,
    deleted: group.deleted_at != null,
  };
}

export function describeActivityForCompass(
  activity: Pick<
    Activity,
    "id" | "group_id" | "name" | "routine" | "archived_at" | "deleted_at"
  >,
  group: Pick<ActivityGroup, "name" | "archived_at" | "deleted_at"> | null
): EvidenceActivity {
  const ownName = activity.name?.trim() ?? "";
  return {
    id: activity.id,
    groupId: activity.group_id,
    name: ownName || group?.name.trim() || "",
    archived: activity.archived_at != null || group?.archived_at != null,
    deleted: activity.deleted_at != null || group?.deleted_at != null,
    avoid: activity.routine === "never",
  };
}

/**
 * The evidence for one goal. A row that somehow links both an activity and a
 * group is read as the activity: one measure, never a blend of the two.
 */
export function goalEvidence(
  goal: Pick<CompassItem, "activity_id" | "group_id">,
  activities: readonly EvidenceActivity[],
  groups: readonly EvidenceGroup[],
  weeks: readonly EvidenceWeek[]
): GoalEvidence {
  if (goal.activity_id) {
    return activityEvidence(goal.activity_id, activities, weeks);
  }
  if (goal.group_id) {
    return groupEvidence(goal.group_id, activities, groups, weeks);
  }
  return { kind: "unlinked" };
}

function activityEvidence(
  id: string,
  activities: readonly EvidenceActivity[],
  weeks: readonly EvidenceWeek[]
): GoalEvidence {
  const activity = activities.find((item) => item.id === id);
  if (!activity) return { kind: "missing", subject: "habit" };
  if (activity.deleted || activity.archived) {
    return { kind: "archived", subject: "habit", name: activity.name };
  }
  if (activity.avoid) return { kind: "uncounted", name: activity.name };
  const week = weeks.find((item) => item.activityId === id);
  if (!week) return { kind: "uncounted", name: activity.name };
  return {
    kind: "record",
    lines: [
      {
        name: activity.name,
        daysDone: week.daysDone,
        daysActive: week.daysActive,
        measure: week.measure,
      },
    ],
  };
}

function groupEvidence(
  id: string,
  activities: readonly EvidenceActivity[],
  groups: readonly EvidenceGroup[],
  weeks: readonly EvidenceWeek[]
): GoalEvidence {
  const group = groups.find((item) => item.id === id);
  if (!group) return { kind: "missing", subject: "group" };
  if (group.deleted || group.archived) {
    return { kind: "archived", subject: "group", name: group.name };
  }

  const lines = activities
    .filter(
      (activity) =>
        activity.groupId === id &&
        !activity.deleted &&
        !activity.archived &&
        !activity.avoid &&
        activity.name.length > 0
    )
    .flatMap((activity) => {
      const week = weeks.find((item) => item.activityId === activity.id);
      if (!week) return [];
      return [
        {
          name: activity.name,
          daysDone: week.daysDone,
          daysActive: week.daysActive,
          measure: week.measure,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (lines.length === 0) return { kind: "uncounted", name: group.name };
  return { kind: "record", lines };
}
