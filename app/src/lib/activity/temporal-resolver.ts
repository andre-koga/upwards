import { db } from "@/lib/db";
import type {
  Activity,
  ActivityDefinitionVersion,
  GroupDefinitionVersion,
} from "@/lib/db/types";
import { toDateString } from "@/lib/time-utils";
import { isRoutineDueOnDate } from "@/lib/activity/utils";
import {
  activityLikeFromDefinition,
  pickDefinitionVersionAsOf,
} from "@/lib/activity/definition-versions";

/**
 * Resolve the activity definition that applied on a logical calendar date.
 * Falls back to the current activity projection when no versions exist yet
 * (pre-migration / dual-write window).
 */
export async function resolveActivityDefinitionAsOf(
  activityId: string,
  logicalDate: string,
  fallbackActivity?: Activity | null
): Promise<ActivityDefinitionVersion | Activity | null> {
  const versions = await db.activityDefinitionVersions
    .where("activity_id")
    .equals(activityId)
    .filter((row) => !row.deleted_at)
    .toArray();

  const picked = pickDefinitionVersionAsOf(versions, logicalDate);
  if (picked) return picked;

  if (fallbackActivity) return fallbackActivity;

  const current = await db.activities.get(activityId);
  return current && !current.deleted_at ? current : null;
}

export async function resolveGroupDefinitionAsOf(
  groupId: string,
  logicalDate: string
): Promise<GroupDefinitionVersion | null> {
  const versions = await db.groupDefinitionVersions
    .where("group_id")
    .equals(groupId)
    .filter((row) => !row.deleted_at)
    .toArray();
  return pickDefinitionVersionAsOf(versions, logicalDate);
}

function isDefinitionVersion(
  value: ActivityDefinitionVersion | Activity
): value is ActivityDefinitionVersion {
  return "effective_from" in value && "activity_id" in value;
}

/**
 * Whether an activity was scheduled on a logical date, using the definition
 * effective that day when versions exist.
 */
export async function isActivityScheduledOnLogicalDate(
  activity: Activity,
  date: Date
): Promise<boolean> {
  const logicalDate = toDateString(date);
  const resolved = await resolveActivityDefinitionAsOf(
    activity.id,
    logicalDate,
    activity
  );
  if (!resolved) return false;

  if (isDefinitionVersion(resolved)) {
    return isRoutineDueOnDate(activityLikeFromDefinition(resolved), date);
  }

  return isRoutineDueOnDate(resolved, date);
}

/**
 * Build a map of activity_id → definition version (or projection fallback)
 * for each activity on a single logical date. Used by stats/completion paths.
 */
export async function resolveActivityDefinitionsForDate(
  activities: Activity[],
  logicalDate: string
): Promise<Map<string, ActivityDefinitionVersion | Activity>> {
  const activityIds = activities.map((a) => a.id);
  const allVersions =
    activityIds.length === 0
      ? []
      : await db.activityDefinitionVersions
          .where("activity_id")
          .anyOf(activityIds)
          .filter((row) => !row.deleted_at)
          .toArray();

  const byActivity = new Map<string, ActivityDefinitionVersion[]>();
  for (const version of allVersions) {
    const list = byActivity.get(version.activity_id) ?? [];
    list.push(version);
    byActivity.set(version.activity_id, list);
  }

  const result = new Map<string, ActivityDefinitionVersion | Activity>();
  for (const activity of activities) {
    const picked = pickDefinitionVersionAsOf(
      byActivity.get(activity.id) ?? [],
      logicalDate
    );
    result.set(activity.id, picked ?? activity);
  }
  return result;
}

/** Convert a resolved definition into fields `isRoutineDueOnDate` understands. */
export function toSchedulableActivity(
  resolved: ActivityDefinitionVersion | Activity
): Pick<Activity, "routine" | "created_at" | "completion_target"> {
  if (isDefinitionVersion(resolved)) {
    const like = activityLikeFromDefinition(resolved);
    return {
      routine: like.routine,
      created_at: like.created_at,
      completion_target: like.completion_target,
    };
  }
  return {
    routine: resolved.routine,
    created_at: resolved.created_at,
    completion_target: resolved.completion_target,
  };
}
