import { now } from "@/lib/db";
import {
  appendActivityStatusEvent,
  appendGroupStatusEvent,
} from "./status-events";
import { stopCurrentActivity } from "./utils";
import { logError } from "@/lib/error-utils";
import { patchActivity, patchActivityGroup } from "@/lib/sync/mutate-synced";

export function activityArchiveFields(
  archived: boolean,
  timestamp: string
): {
  is_archived: boolean;
  completed_at: string | null;
  updated_at: string;
} {
  return {
    is_archived: archived,
    completed_at: archived ? timestamp : null,
    updated_at: timestamp,
  };
}

/**
 * Archive or restore a habit. Dual-writes `is_archived` and legacy `completed_at`.
 */
export async function setActivityArchived(
  activityId: string,
  archived: boolean,
  actionDate: Date = new Date()
): Promise<void> {
  try {
    if (archived) {
      await stopCurrentActivity({ activityId });
    }
    const n = now();
    await appendActivityStatusEvent(
      activityId,
      "archived",
      archived,
      actionDate
    );
    await patchActivity(activityId, activityArchiveFields(archived, n));
  } catch (error) {
    logError("Error updating activity archive", error);
    throw error;
  }
}

export async function archiveActivityById(
  activityId: string,
  actionDate: Date = new Date()
): Promise<void> {
  await setActivityArchived(activityId, true, actionDate);
}

export async function unarchiveActivityById(
  activityId: string,
  actionDate: Date = new Date()
): Promise<void> {
  await setActivityArchived(activityId, false, actionDate);
}

/**
 * Restore an archived group. Activities become visible again via group archive events.
 */
export async function unarchiveGroupById(
  groupId: string,
  actionDate: Date = new Date()
): Promise<void> {
  const n = now();
  await appendGroupStatusEvent(groupId, "archived", false, actionDate);
  await patchActivityGroup(groupId, {
    is_archived: false,
    updated_at: n,
  });
}
