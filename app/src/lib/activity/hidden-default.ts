import { db, now, newId } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";

const LEGACY_GROUP_DEFAULT_ROUTINE = "__group_default_hidden__";

/** Activity with name === null is the group-default (timing the group without a specific activity). */
export function isHiddenGroupDefaultActivity(activity: Activity): boolean {
  return (
    activity.name === null ||
    activity.routine === LEGACY_GROUP_DEFAULT_ROUTINE ||
    (activity as { pattern?: string }).pattern === LEGACY_GROUP_DEFAULT_ROUTINE
  );
}

export async function getOrCreateHiddenGroupDefaultActivity(
  group: ActivityGroup
): Promise<Activity> {
  const existing = await db.activities
    .filter(
      (activity) =>
        activity.group_id === group.id &&
        !activity.deleted_at &&
        (activity.name === null ||
          activity.routine === LEGACY_GROUP_DEFAULT_ROUTINE ||
          (activity as { pattern?: string }).pattern ===
            LEGACY_GROUP_DEFAULT_ROUTINE)
    )
    .first();

  const timestamp = now();

  if (existing) {
    const updates: Partial<Activity> = { updated_at: timestamp };
    if (existing.name !== null) {
      updates.name = null;
      updates.routine = null;
    }
    await db.activities.update(existing.id, updates);
    return { ...existing, ...updates };
  }

  const groupDefaultActivity: Activity = {
    id: newId(),
    group_id: group.id,
    name: null,
    routine: null,
    completion_target: 1,
    is_archived: false,
    order_index: null,
    created_at: timestamp,
    updated_at: timestamp,
    synced_at: null,
    deleted_at: null,
  };

  await db.activities.add(groupDefaultActivity);
  return groupDefaultActivity;
}
