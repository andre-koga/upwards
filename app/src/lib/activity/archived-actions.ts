import { now } from "@/lib/db";
import { stopCurrentActivity } from "./utils";
import { logError } from "@/lib/error-utils";
import { patchActivity, patchActivityGroup } from "@/lib/sync/mutate-synced";

/**
 * Archive state is one timestamp on the row (product-scope.md §2.10): set when
 * archived, cleared on restore. The item stays on days before it and drops off
 * from the next day on.
 */
export function activityArchiveFields(
  archived: boolean,
  timestamp: string
): {
  archived_at: string | null;
  updated_at: string;
} {
  return {
    archived_at: archived ? timestamp : null,
    updated_at: timestamp,
  };
}

export async function setActivityArchived(
  activityId: string,
  archived: boolean
): Promise<void> {
  try {
    if (archived) {
      await stopCurrentActivity({ activityId });
    }
    await patchActivity(activityId, activityArchiveFields(archived, now()));
  } catch (error) {
    logError("Error updating activity archive", error);
    throw error;
  }
}

export async function archiveActivityById(activityId: string): Promise<void> {
  await setActivityArchived(activityId, true);
}

export async function unarchiveActivityById(activityId: string): Promise<void> {
  await setActivityArchived(activityId, false);
}

export async function archiveGroupById(groupId: string): Promise<void> {
  await stopCurrentActivity({ groupId });
  await patchActivityGroup(groupId, activityArchiveFields(true, now()));
}

/** Restore an archived group; its activities reappear with it. */
export async function unarchiveGroupById(groupId: string): Promise<void> {
  await patchActivityGroup(groupId, activityArchiveFields(false, now()));
}
