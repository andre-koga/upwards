import type { Memory } from "@/lib/db/types";
import type { JournalArchiveFilters } from "./archive";
import { memoryHasContent } from "@/lib/memories";
import { getActiveLocaleTag } from "@/lib/i18n";
import { fromDateString, toDateString } from "@/lib/time-utils";

/**
 * The journal and memories are one record (design-and-branding.md §3.1). A day
 * stands on the day it describes. A memory stands on the day it was
 * remembered: the local day it was written down. Its `time_label` ("when I was
 * six") is the person's own words for when it happened; it is the memory's
 * title and is searchable, but it is not parsed and it does not place the
 * memory. The tables stay separate; this is the shared view.
 */

/**
 * The local calendar day a memory was remembered on. Editing it later does not
 * move it, because `created_at` does not change.
 */
export function memoryRememberedDate(
  memory: Pick<Memory, "created_at">
): string {
  const at = new Date(memory.created_at);
  return Number.isNaN(at.getTime())
    ? memory.created_at.slice(0, 10)
    : toDateString(at);
}

/** "Wednesday, October 14, 2026" in the app language, for searching by date. */
export function formatSearchableDate(entryDate: string): string {
  return fromDateString(entryDate).toLocaleDateString(getActiveLocaleTag(), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Memories shown in the record: not trashed, with something in them. */
export function recordMemories(memories: readonly Memory[]): Memory[] {
  return memories.filter(
    (memory) => !memory.deleted_at && memoryHasContent(memory)
  );
}

/** Memories by the day they were remembered; the latest of a day comes first. */
export function memoriesByDate(
  memories: readonly Memory[]
): Map<string, Memory[]> {
  const byDate = new Map<string, Memory[]>();
  for (const memory of memories) {
    const date = memoryRememberedDate(memory);
    const list = byDate.get(date) ?? [];
    list.push(memory);
    byDate.set(date, list);
  }
  for (const list of byDate.values()) {
    list.sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
    );
  }
  return byDate;
}

/** Years in which memories were remembered, for the year filter. */
export function collectMemoryYears(memories: readonly Memory[]): number[] {
  const years = new Set<number>();
  for (const memory of memories) {
    years.add(Number(memoryRememberedDate(memory).slice(0, 4)));
  }
  return [...years];
}

/**
 * Whether a memory belongs in the results for these filters. A memory has no
 * bookmark, video or place, so a filter that requires one leaves it out and one
 * that excludes one keeps it. A date window takes it by the day it was
 * remembered, like any day.
 */
export function memoryMatchesFilters(
  memory: Memory,
  filters: JournalArchiveFilters
): boolean {
  if (filters.mapEntryDates?.length) return false;
  if (filters.bookmarked === "yes") return false;
  if (filters.hasVideo === "yes") return false;
  if (filters.hasPlaces === "yes") return false;

  const hasPhotos = Boolean(memory.photo_paths?.length);
  if (filters.hasPhotos === "yes" && !hasPhotos) return false;
  if (filters.hasPhotos === "no" && hasPhotos) return false;

  const date = memoryRememberedDate(memory);

  if (filters.dateRange) {
    if (date < filters.dateRange.start || date > filters.dateRange.end) {
      return false;
    }
  }

  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    memory.text_content ?? "",
    memory.time_label ?? "",
    date,
    formatSearchableDate(date),
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
