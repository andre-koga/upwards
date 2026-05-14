import { db, now } from "@/lib/db";

/**
 * Restore an archived group and unarchive all activities in it (same behavior
 * as the archived settings page).
 */
export async function unarchiveGroupById(groupId: string): Promise<void> {
  const n = now();
  await db.activityGroups.update(groupId, {
    is_archived: false,
    updated_at: n,
  });
  const activities = await db.activities
    .filter((a) => a.group_id === groupId && !a.deleted_at)
    .toArray();
  await Promise.all(
    activities.map((a) =>
      db.activities.update(a.id, { is_archived: false, updated_at: n })
    )
  );
}

/** Restore a single archived activity; unarchives its group if the group is archived. */
export async function unarchiveActivityById(activityId: string): Promise<void> {
  const activity = await db.activities.get(activityId);
  if (!activity || activity.deleted_at) return;
  const n = now();
  const group = await db.activityGroups.get(activity.group_id);
  if (group && !group.deleted_at && group.is_archived) {
    await db.activityGroups.update(group.id, {
      is_archived: false,
      updated_at: n,
    });
  }
  await db.activities.update(activityId, {
    is_archived: false,
    updated_at: n,
  });
}
