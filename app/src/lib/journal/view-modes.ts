import type { JournalEntry, Memory } from "@/lib/db/types";
import { memoryRememberedDate, recordMemories } from "./record";

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
  /** The day it stands on: the day itself, or the day a memory was remembered. */
  entryDate: string;
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
 * of the day it stands on, newest first. A memory's photos stand on the day it
 * was remembered, after that day's own media. Within a day the clip leads and
 * the photos keep the order they were added in, as on the day itself.
 */
export function buildGalleryMonths(
  entries: readonly JournalEntry[],
  memories: readonly Memory[],
  options: { includeVideo: boolean }
): GalleryMonth[] {
  const byDate = new Map<string, GalleryItem[]>();
  const add = (date: string, items: GalleryItem[]) => {
    if (items.length === 0) return;
    byDate.set(date, [...(byDate.get(date) ?? []), ...items]);
  };

  for (const entry of entries) {
    if (entry.deleted_at) continue;
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
    add(entry.entry_date, items);
  }

  // Latest remembered first within a day, so the gallery reads like the feed.
  const orderedMemories = [...recordMemories(memories)].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
  );
  for (const memory of orderedMemories) {
    const date = memoryRememberedDate(memory);
    add(
      date,
      (memory.photo_paths ?? [])
        .filter((path) => path.trim())
        .map(
          (path): GalleryItem => ({
            key: `memory:${memory.id}:photo:${path}`,
            kind: "photo",
            path,
            poster: null,
            entryDate: date,
            memoryId: memory.id,
            emoji: null,
            caption: memory.time_label?.trim() || null,
          })
        )
    );
  }

  const months: GalleryMonth[] = [];
  for (const date of [...byDate.keys()].sort((a, b) => b.localeCompare(a))) {
    const key = date.slice(0, 7);
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
    month.items.push(...(byDate.get(date) ?? []));
  }
  return months;
}
