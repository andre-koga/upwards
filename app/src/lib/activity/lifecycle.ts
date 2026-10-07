import { endOfDay, startOfDay } from "@/lib/time-utils";

/**
 * Lifecycle as timestamps, not an event log (product-scope.md §2.10). An
 * activity or group is archived or deleted from a moment onward; past days
 * before that moment still show it, so history keeps its retired items.
 *
 * Both rules keep what the event log did:
 * - Archiving hides the item from the NEXT day on. The day you archive it, it
 *   is still there (you may be in the middle of using it).
 * - Deleting hides it from THAT day on. It vanishes straight away.
 */

interface Archivable {
  archived_at?: string | null;
}

interface Deletable {
  deleted_at?: string | null;
}

/** Archived on or before the start of `day`. */
export function isArchivedAsOf(entity: Archivable, day: Date): boolean {
  if (!entity.archived_at) return false;
  return startOfDay(day).getTime() >= new Date(entity.archived_at).getTime();
}

/** Deleted at any point up to the end of `day`. */
export function isDeletedAsOf(entity: Deletable, day: Date): boolean {
  if (!entity.deleted_at) return false;
  return endOfDay(day).getTime() >= new Date(entity.deleted_at).getTime();
}

/** Archived or deleted as of `day`: gone from that day's list. */
export function isRetiredAsOf(
  entity: Archivable & Deletable,
  day: Date
): boolean {
  return isArchivedAsOf(entity, day) || isDeletedAsOf(entity, day);
}

/** Archived now (and not deleted): the state the archive lists show. */
export function isArchivedNow(entity: Archivable & Deletable): boolean {
  return Boolean(entity.archived_at) && !entity.deleted_at;
}
