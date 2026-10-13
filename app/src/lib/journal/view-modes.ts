import type { JournalEntry, Memory } from "@/lib/db/types";
import { groupMemoriesByYear } from "./record";

/** The four ways to browse the one record (design-and-branding.md §3.3). */
const JOURNAL_VIEWS = ["feed", "calendar", "map", "gallery"] as const;
export type JournalView = (typeof JOURNAL_VIEWS)[number];

export const DEFAULT_JOURNAL_VIEW: JournalView = "feed";

/** The view named in the address, or the feed for anything else. */
export function parseJournalView(value: string | null): JournalView {
  return (JOURNAL_VIEWS as readonly string[]).includes(value ?? "")
    ? (value as JournalView)
    : DEFAULT_JOURNAL_VIEW;
}

export interface GalleryItem {
  /** Stable across renders: the day or memory plus the media it points at. */
  key: string;
  kind: "photo" | "video";
  /** Photo storage path, or video storage path. */
  path: string;
  /** A clip's stored poster (a data URL), when one was generated. */
  poster: string | null;
  /** The day it belongs to; null for a memory, whose date is approximate. */
  entryDate: string | null;
  /** The memory it belongs to; null for a day. */
  memoryId: string | null;
  /** The day's emoji. */
  emoji: string | null;
  /** The day's title, or a memory's own words for when it happened. */
  caption: string | null;
}

export interface GalleryMonth {
  /** "2026-10" */
  key: string;
  year: number;
  /** 1-12 */
  month: number;
  items: GalleryItem[];
}

/**
 * Every photo, and every clip when the daily clip is on, grouped by the month
 * of the day it belongs to, newest first. Within a day the clip leads and the
 * photos keep the order they were added in, as on the day itself.
 */
export function buildGalleryMonths(
  entries: readonly JournalEntry[],
  options: { includeVideo: boolean }
): GalleryMonth[] {
  const sorted = [...entries]
    .filter((entry) => !entry.deleted_at)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  const months: GalleryMonth[] = [];
  for (const entry of sorted) {
    const items: GalleryItem[] = [];
    const base = {
      entryDate: entry.entry_date,
      memoryId: null,
      emoji: entry.day_emoji?.trim() || null,
      caption: entry.title?.trim() || null,
    };
    const videoPath = entry.video_path?.trim();
    if (options.includeVideo && (videoPath || entry.video_thumbnail?.trim())) {
      items.push({
        ...base,
        key: `${entry.entry_date}:video:${videoPath ?? ""}`,
        kind: "video",
        path: videoPath ?? "",
        poster: entry.video_thumbnail?.trim() || null,
      });
    }
    for (const path of entry.photo_paths ?? []) {
      if (!path.trim()) continue;
      items.push({
        ...base,
        key: `${entry.entry_date}:photo:${path}`,
        kind: "photo",
        path,
        poster: null,
      });
    }
    if (items.length === 0) continue;

    const key = entry.entry_date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.key !== key) {
      month = {
        key,
        year: Number(key.slice(0, 4)),
        month: Number(key.slice(5, 7)),
        items: [],
      };
      months.push(month);
    }
    month.items.push(...items);
  }
  return months;
}

export interface GalleryMemoryGroup {
  key: string;
  /** The year the memories are placed at, or null for undated ones. */
  year: number | null;
  items: GalleryItem[];
}

/**
 * Photos from memories, grouped the way the feed places them: by the year in
 * their own words, newest first, undated last. A memory has no month, so these
 * follow the months rather than being given one.
 */
export function buildGalleryMemoryGroups(
  memories: readonly Memory[],
  maxYear = new Date().getFullYear()
): GalleryMemoryGroup[] {
  return groupMemoriesByYear(
    memories.filter((memory) => !memory.deleted_at),
    maxYear
  )
    .map((group) => ({
      key: `memories-${group.year ?? "undated"}`,
      year: group.year,
      items: group.memories.flatMap((memory) =>
        (memory.photo_paths ?? [])
          .filter((path) => path.trim())
          .map(
            (path): GalleryItem => ({
              key: `memory:${memory.id}:photo:${path}`,
              kind: "photo",
              path,
              poster: null,
              entryDate: null,
              memoryId: memory.id,
              emoji: null,
              caption: memory.time_label?.trim() || null,
            })
          )
      ),
    }))
    .filter((group) => group.items.length > 0);
}
