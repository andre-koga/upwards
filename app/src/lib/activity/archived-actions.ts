import { db, now } from "@/lib/db";
import { appendGroupStatusEvent } from "./status-events";

/**
 * Restore an archived group. Activities become visible again via group archive events.
 */
export async function unarchiveGroupById(
  groupId: string,
  actionDate: Date = new Date()
): Promise<void> {
  const n = now();
  await appendGroupStatusEvent(groupId, "archived", false, actionDate);
  await db.activityGroups.update(groupId, {
    is_archived: false,
    updated_at: n,
  });
}
