import { db, newId, now } from "@/lib/db";
import type { JournalEntry, JournalEntryRevision } from "@/lib/db/types";
import { journalEntryForDate } from "@/lib/journal/entry-for-date";
import {
  buildJournalRevision,
  hasJournalChange,
  summarizeJournalChange,
  type RevisableJournalFields,
} from "@/lib/journal/old-day-edit";
import { getActiveLocaleTag } from "@/lib/i18n";
import { naturalJournalIdForDate } from "@/lib/sync/natural-ids";
import {
  recordJournalRevision,
  saveJournalEntry,
} from "@/lib/sync/mutate-synced";

/**
 * Every earlier version of a day, newest first. Revisions are append-only, so
 * this list only ever grows (product-scope.md §2.3).
 */
export async function journalRevisionsForDate(
  entryDate: string
): Promise<JournalEntryRevision[]> {
  const revisions = await db.journalEntryRevisions
    .where("entry_date")
    .equals(entryDate)
    .toArray();
  return sortRevisionsNewestFirst(revisions);
}

export function sortRevisionsNewestFirst(
  revisions: JournalEntryRevision[]
): JournalEntryRevision[] {
  // `id` breaks ties so two devices see the same order for equal timestamps.
  return [...revisions].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
  );
}

export interface RevisionSummary {
  count: number;
  /**
   * When the day was last changed: the moment its newest revision was
   * recorded, which is when that confirmed edit began.
   */
  editedAt: string;
}

/** Which days have earlier versions, and when each was last changed. */
export function summarizeRevisionsByDate(
  revisions: Array<Pick<JournalEntryRevision, "entry_date" | "created_at">>
): Map<string, RevisionSummary> {
  const byDate = new Map<string, RevisionSummary>();
  for (const revision of revisions) {
    const found = byDate.get(revision.entry_date);
    byDate.set(revision.entry_date, {
      count: (found?.count ?? 0) + 1,
      editedAt:
        found && found.editedAt > revision.created_at
          ? found.editedAt
          : revision.created_at,
    });
  }
  return byDate;
}

export async function journalRevisionSummaries(): Promise<
  Map<string, RevisionSummary>
> {
  const rows: Array<Pick<JournalEntryRevision, "entry_date" | "created_at">> =
    [];
  await db.journalEntryRevisions.each((revision) =>
    rows.push({
      entry_date: revision.entry_date,
      created_at: revision.created_at,
    })
  );
  return summarizeRevisionsByDate(rows);
}

export function revisionFields(
  revision: JournalEntryRevision
): RevisableJournalFields {
  return {
    title: revision.title,
    day_emoji: revision.day_emoji,
    text_content: revision.text_content,
    photo_paths: revision.photo_paths,
    video_path: revision.video_path,
  };
}

export type RestoreResult = "restored" | "unchanged" | "missing";

/**
 * Bring a previous version back as the day's current words and media.
 *
 * Restoring is itself an edit that overwrites, so the values it replaces are
 * kept as a new revision first: a restore can be undone by restoring the
 * version it displaced. Nothing is deleted, including photos the restored
 * version no longer uses, because that new revision still points at them.
 * Hearts and places are not part of a version and are left as they are.
 */
export async function restoreJournalRevision(
  revisionId: string
): Promise<RestoreResult> {
  const revision = await db.journalEntryRevisions.get(revisionId);
  if (!revision) return "missing";

  const target = revisionFields(revision);
  const existing = await journalEntryForDate(revision.entry_date);
  if (existing && !hasJournalChange(summarizeJournalChange(existing, target))) {
    return "unchanged";
  }

  const at = now();
  const displaced = buildJournalRevision({
    before: existing,
    after: target,
    id: newId(),
    at,
    videoThumbnail: existing?.video_thumbnail ?? null,
  });
  if (displaced) await recordJournalRevision(displaced);

  // A thumbnail belongs to the clip it was made from.
  const videoThumbnail =
    existing && existing.video_path === target.video_path
      ? existing.video_thumbnail
      : revision.video_thumbnail;

  if (existing) {
    const restored: JournalEntry = {
      ...existing,
      ...target,
      video_thumbnail: videoThumbnail,
      updated_at: at,
    };
    await saveJournalEntry(restored, existing.updated_at);
  } else {
    await saveJournalEntry({
      id: naturalJournalIdForDate(revision.entry_date),
      entry_date: revision.entry_date,
      ...target,
      is_bookmarked: false,
      video_thumbnail: videoThumbnail,
      location: null,
      created_at: at,
      updated_at: at,
      synced_at: null,
      deleted_at: null,
    });
  }
  return "restored";
}

/** "12 Oct 2026, 3:04 PM" in the app language; empty for an unreadable time. */
export function formatRevisionMoment(iso: string): string {
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return "";
  return moment.toLocaleString(getActiveLocaleTag(), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** "2 Oct 2026" in the app language, for the muted "Edited" note. */
export function formatEditedDate(iso: string): string {
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return "";
  return moment.toLocaleDateString(getActiveLocaleTag(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
