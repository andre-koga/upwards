import type { JournalEntry, LocationData } from "@/lib/db/types";
import { MAX_DAILY_LOCATIONS, normalizeJournalLocationRoute } from "./utils";

/**
 * "Keep both" for a journal day in conflict (product-scope.md §2.10): the two
 * versions' words joined with a divider, and their photos and places unioned.
 *
 * Nothing is dropped to make room. The text may come out longer than the
 * editor's own limit; the result is then opened for editing, where the person
 * trims it, and a longer text is never silently cut. Photos and places have
 * hard caps (eight and five), so past those the overflow is dropped, newest
 * kept: the edit-dialog would refuse to hold more.
 */

/** The line between the two versions of the text. */
export const KEEP_BOTH_DIVIDER = "\n\n— — —\n\n";
export const MAX_JOURNAL_PHOTOS = 8;

export type KeepBothFields = Pick<
  JournalEntry,
  | "title"
  | "text_content"
  | "day_emoji"
  | "is_bookmarked"
  | "video_path"
  | "video_thumbnail"
  | "photo_paths"
  | "location"
>;

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** First non-empty value, this device's first. */
function firstPresent(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const found = present(value);
    if (found) return found;
  }
  return null;
}

/**
 * The two texts as one. Identical texts are not repeated, and a text that
 * already contains the other (an edit that only added to it) is kept alone, so
 * "keep both" on a plain extension reads as that extension, not as a duplicate.
 */
export function joinJournalText(
  mine: string | null | undefined,
  theirs: string | null | undefined
): string | null {
  const a = present(mine);
  const b = present(theirs);
  if (!a || !b) return a ?? b;
  if (a === b) return a;
  if (a.includes(b)) return a;
  if (b.includes(a)) return b;
  return `${a}${KEEP_BOTH_DIVIDER}${b}`;
}

function unionPhotos(
  mine: readonly string[] | null,
  theirs: readonly string[] | null
): string[] | null {
  const all: string[] = [];
  for (const path of [...(mine ?? []), ...(theirs ?? [])]) {
    if (path.trim() && !all.includes(path)) all.push(path);
  }
  if (all.length === 0) return null;
  // Past the cap the newest are kept, as the editor does when it is full.
  return all.slice(-MAX_JOURNAL_PHOTOS);
}

function unionPlaces(
  mine: JournalEntry["location"],
  theirs: JournalEntry["location"]
): JournalEntry["location"] {
  const locations: LocationData[] = normalizeJournalLocationRoute({
    locations: [...(mine?.locations ?? []), ...(theirs?.locations ?? [])],
  }).locations.slice(0, MAX_DAILY_LOCATIONS);
  return locations.length > 0 ? { locations } : null;
}

/**
 * The fields of the kept-both day. Text, photos and places are joined or
 * unioned; for a single-valued field (title, emoji, clip) this device's value
 * is kept, and the other's fills in only where this device has none. A heart
 * set on either side stays set.
 */
export function keepBothFields(
  mine: KeepBothFields,
  theirs: KeepBothFields
): KeepBothFields {
  const useMyClip = Boolean(present(mine.video_path));
  return {
    title: firstPresent(mine.title, theirs.title),
    text_content: joinJournalText(mine.text_content, theirs.text_content),
    day_emoji: firstPresent(mine.day_emoji, theirs.day_emoji),
    is_bookmarked: Boolean(mine.is_bookmarked || theirs.is_bookmarked),
    video_path: useMyClip
      ? present(mine.video_path)
      : present(theirs.video_path),
    video_thumbnail: useMyClip
      ? (mine.video_thumbnail ?? null)
      : (theirs.video_thumbnail ?? null),
    photo_paths: unionPhotos(mine.photo_paths, theirs.photo_paths),
    location: unionPlaces(mine.location, theirs.location),
  };
}
