import type { Memory } from "@/lib/db/types";
import type { JournalArchiveFilters } from "./archive";
import { memoryHasContent } from "@/lib/memories";

/**
 * The journal and memories are one record, told apart by how well the date is
 * known (design-and-branding.md §3.1). A journal entry has an exact day. A
 * memory has the owner's own words for when it happened ("when I was six"), so
 * its date is approximate. The tables stay separate; this is the shared view.
 */
export type DatePrecision = "exact" | "approximate";

const YEAR_PATTERN = /(?<!\d)(?:19|20)\d{2}(?!\d)/g;

/**
 * The year a memory is placed at in the record, read from its own label
 * ("Summer 2019", "1999 to 2001" -> the later year). Null when the label names
 * no year ("when I was six"): those sit together at the end, undated, rather
 * than being given a date the person never gave. A year in the future is
 * ignored, since a memory cannot be from then.
 */
export function memoryAnchorYear(
  label: string | null | undefined,
  maxYear = new Date().getFullYear()
): number | null {
  const years = (label ?? "")
    .match(YEAR_PATTERN)
    ?.map(Number)
    .filter((year) => year <= maxYear);
  return years?.length ? Math.max(...years) : null;
}

/** Memories shown in the record: not trashed, with something in them. */
export function recordMemories(memories: readonly Memory[]): Memory[] {
  return memories.filter(
    (memory) => !memory.deleted_at && memoryHasContent(memory)
  );
}

/** Years that memories are anchored to, for the year filter. */
export function collectMemoryYears(memories: readonly Memory[]): number[] {
  const years = new Set<number>();
  for (const memory of memories) {
    const year = memoryAnchorYear(memory.time_label);
    if (year !== null) years.add(year);
  }
  return [...years];
}

/**
 * Whether a memory belongs in the results for these filters. A memory has no
 * bookmark, video or place, so a filter that requires one leaves it out and one
 * that excludes one keeps it. It has no exact day, so a date window only takes
 * it when the window covers the whole of its year.
 */
export function memoryMatchesFilters(
  memory: Memory,
  filters: JournalArchiveFilters,
  maxYear = new Date().getFullYear()
): boolean {
  if (filters.mapEntryDates?.length) return false;
  if (filters.bookmarked === "yes") return false;
  if (filters.hasVideo === "yes") return false;
  if (filters.hasPlaces === "yes") return false;

  const hasPhotos = Boolean(memory.photo_paths?.length);
  if (filters.hasPhotos === "yes" && !hasPhotos) return false;
  if (filters.hasPhotos === "no" && hasPhotos) return false;

  const year = memoryAnchorYear(memory.time_label, maxYear);

  if (filters.dateRange) {
    if (year === null) return false;
    const { preset, year: rangeYear, start, end } = filters.dateRange;
    const covers =
      preset === "year" && rangeYear != null
        ? rangeYear === year
        : start <= `${year}-01-01` && end >= `${year}-12-31`;
    if (!covers) return false;
  }

  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    memory.text_content ?? "",
    memory.time_label ?? "",
    year === null ? "" : String(year),
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** A memory group in the feed: a year, or null for undated memories. */
export interface MemoryGroup {
  year: number | null;
  memories: Memory[];
}

/**
 * Memories grouped by their anchor year, newest year first, with the undated
 * group last. Inside a group the most recently written comes first.
 */
export function groupMemoriesByYear(
  memories: readonly Memory[],
  maxYear = new Date().getFullYear()
): MemoryGroup[] {
  const byYear = new Map<number | null, Memory[]>();
  for (const memory of memories) {
    const year = memoryAnchorYear(memory.time_label, maxYear);
    const list = byYear.get(year) ?? [];
    list.push(memory);
    byYear.set(year, list);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    })
    .map(([year, list]) => ({
      year,
      memories: [...list].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
    }));
}
