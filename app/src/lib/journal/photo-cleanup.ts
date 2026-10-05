import { db } from "@/lib/db";
import { deleteJournalPhoto } from "./photo-storage";
import { pathsReferencedByRevisions } from "./old-day-edit";

/**
 * Delete photos a saved entry no longer uses, except those a revision still
 * points at: deleting them would make "Previous versions" unrestorable.
 */
export async function deletePhotosNoLongerUsed(
  removedPaths: string[]
): Promise<void> {
  if (removedPaths.length === 0) return;
  const keep = pathsReferencedByRevisions(
    await db.journalEntryRevisions.toArray()
  );
  await Promise.all(
    removedPaths
      .filter((path) => !keep.has(path))
      .map((path) => deleteJournalPhoto(path).catch(() => undefined))
  );
}
