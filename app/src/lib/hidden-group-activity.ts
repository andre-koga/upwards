import { db, now, newId } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";

export const HIDDEN_GROUP_ACTIVITY_PATTERN = "__group_default_hidden__";

export function isHiddenGroupDefaultActivity(activity: Activity): boolean {
  return activity.pattern === HIDDEN_GROUP_ACTIVITY_PATTERN;
}

export async function getOrCreateHiddenGroupDefaultActivity(
  group: ActivityGroup
): Promise<Activity> {
  const existing = await db.activities
    .filter(
      (activity) =>
        activity.group_id === group.id &&
        activity.pattern === HIDDEN_GROUP_ACTIVITY_PATTERN &&
        !activity.deleted_at
    )
    .first();

  const timestamp = now();

  if (existing) {
    await db.activities.update(existing.id, {
      name: group.name,
      color: group.color,
      updated_at: timestamp,
    });

    return {
      ...existing,
      name: group.name,
      color: group.color,
      updated_at: timestamp,
    };
  }

  const hiddenActivity: Activity = {
    id: newId(),
    group_id: group.id,
    name: group.name,
    pattern: HIDDEN_GROUP_ACTIVITY_PATTERN,
    routine: "never",
    completion_target: 1,
    color: group.color,
    is_archived: false,
    order_index: null,
    created_at: timestamp,
    updated_at: timestamp,
    synced_at: null,
    deleted_at: null,
  };

  await db.activities.add(hiddenActivity);
  return hiddenActivity;
}
