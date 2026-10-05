import type { JournalEntry, JournalEntryRevision } from "@/lib/db/types";
import { fromDateString, toDateString } from "@/lib/time-utils";

/**
 * Days older than this ask for confirmation before a change is saved. Nothing
 * is locked: every day stays editable (product-scope.md §2.3).
 */
export const OLD_DAY_CONFIRM_AFTER_DAYS = 7;

/** Whether a save to this local calendar date needs a confirmation first. */
export function isOldDay(dateString: string, now: Date = new Date()): boolean {
  const today = fromDateString(toDateString(now)).getTime();
  const day = fromDateString(dateString).getTime();
  // Round: DST days are 23 or 25 hours, so divide-and-floor would be off by one.
  const daysAgo = Math.round((today - day) / 86_400_000);
  return daysAgo > OLD_DAY_CONFIRM_AFTER_DAYS;
}

/** The journal fields whose previous values a revision keeps. */
export type RevisableJournalFields = Pick<
  JournalEntry,
  "title" | "day_emoji" | "text_content" | "photo_paths" | "video_path"
>;

export interface JournalChangeSummary {
  title: "added" | "changed" | "removed" | null;
  emoji: "added" | "changed" | "removed" | null;
  text: "added" | "changed" | "removed" | null;
  video: "added" | "changed" | "removed" | null;
  photosAdded: number;
  photosRemoved: number;
}

const blank = (value: string | null | undefined) => !value?.trim();

function change(
  before: string | null | undefined,
  after: string | null | undefined
): "added" | "changed" | "removed" | null {
  const b = before?.trim() ?? "";
  const a = after?.trim() ?? "";
  if (b === a) return null;
  if (!b) return "added";
  if (!a) return "removed";
  return "changed";
}

/** What saving `after` over `before` would do, field by field. */
export function summarizeJournalChange(
  before: RevisableJournalFields | null | undefined,
  after: RevisableJournalFields
): JournalChangeSummary {
  const beforePhotos = before?.photo_paths ?? [];
  const afterPhotos = after.photo_paths ?? [];
  return {
    title: change(before?.title, after.title),
    emoji: change(before?.day_emoji, after.day_emoji),
    text: change(before?.text_content, after.text_content),
    video: change(before?.video_path, after.video_path),
    photosAdded: afterPhotos.filter((path) => !beforePhotos.includes(path))
      .length,
    photosRemoved: beforePhotos.filter((path) => !afterPhotos.includes(path))
      .length,
  };
}

export function hasJournalChange(summary: JournalChangeSummary): boolean {
  return (
    summary.title !== null ||
    summary.emoji !== null ||
    summary.text !== null ||
    summary.video !== null ||
    summary.photosAdded > 0 ||
    summary.photosRemoved > 0
  );
}

/** Whether the entry held anything a revision would need to preserve. */
export function hasRevisableContent(
  entry: RevisableJournalFields | null | undefined
): boolean {
  if (!entry) return false;
  return (
    !blank(entry.title) ||
    !blank(entry.day_emoji) ||
    !blank(entry.text_content) ||
    !blank(entry.video_path) ||
    (entry.photo_paths?.length ?? 0) > 0
  );
}

/**
 * The revision to record for a confirmed edit, or null when nothing was
 * overwritten: there was no earlier content, or the edit only added to it.
 * Hearting and places never reach here, since they are not revisable fields.
 */
export function buildJournalRevision(params: {
  before: (RevisableJournalFields & { entry_date: string }) | null | undefined;
  after: RevisableJournalFields;
  id: string;
  at: string;
  videoThumbnail: string | null;
}): JournalEntryRevision | null {
  const { before, after } = params;
  if (!before || !hasRevisableContent(before)) return null;
  if (!hasJournalChange(summarizeJournalChange(before, after))) return null;
  return {
    id: params.id,
    entry_date: before.entry_date,
    title: before.title ?? null,
    day_emoji: before.day_emoji ?? null,
    text_content: before.text_content ?? null,
    photo_paths: before.photo_paths ?? null,
    video_path: before.video_path ?? null,
    video_thumbnail: params.videoThumbnail,
    created_at: params.at,
    updated_at: params.at,
    synced_at: null,
  };
}

/**
 * Storage objects a revision still points at. Deleting one would make the
 * revision unrestorable, so photo and clip cleanup must skip these.
 */
export function pathsReferencedByRevisions(
  revisions: Array<Pick<JournalEntryRevision, "photo_paths" | "video_path">>
): Set<string> {
  const paths = new Set<string>();
  for (const revision of revisions) {
    for (const path of revision.photo_paths ?? []) paths.add(path);
    if (revision.video_path) paths.add(revision.video_path);
  }
  return paths;
}
