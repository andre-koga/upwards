import type { JournalEntry } from "@/lib/db/types";
import { getHolidayName } from "@/lib/journal/holidays";
import type { LocaleValue } from "@/lib/i18n/locale-storage";
import { fromDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";

/** sessionStorage key used when jumping from the archive feed to a specific day. */
export const JOURNAL_JUMP_DATE_KEY = "okhabit:journal-jump-date";

export function journalEntryHasContent(entry: JournalEntry): boolean {
  if (entry.deleted_at) return false;
  if (entry.day_emoji?.trim()) return true;
  if (entry.title?.trim()) return true;
  if (entry.text_content?.trim()) return true;
  if (entry.video_path?.trim()) return true;
  if (entry.photo_paths && entry.photo_paths.length > 0) return true;
  if (entry.location?.locations && entry.location.locations.length > 0) {
    return true;
  }
  return false;
}

function locationSearchText(entry: JournalEntry): string {
  const locations = entry.location?.locations;
  if (!locations?.length) return "";
  return locations
    .map((l) =>
      [l.displayName, l.city, l.state, l.country].filter(Boolean).join(" ")
    )
    .join(" ");
}

function formatSearchableDate(entryDate: string): string {
  const date = fromDateString(entryDate);
  return date.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Case-insensitive match across title, text, emoji, locations, date, holiday. */
export function journalEntryMatchesQuery(
  entry: JournalEntry,
  query: string,
  locale: LocaleValue
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const holiday = getHolidayName(entry.entry_date, locale) ?? "";
  const haystack = [
    entry.title ?? "",
    entry.text_content ?? "",
    entry.day_emoji ?? "",
    entry.entry_date,
    formatSearchableDate(entry.entry_date),
    locationSearchText(entry),
    holiday,
    entry.is_bookmarked ? "bookmark bookmarked" : "",
  ]
    .join(" ")
    .toLowerCase();

  const terms = q.split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

/** Tri-state structured filter: any / require / exclude. */
export type JournalArchiveTriFilter = "any" | "yes" | "no";

export type JournalArchiveFilterKey =
  | "bookmarked"
  | "hasPhotos"
  | "hasVideo"
  | "hasPlaces";

/** Free-text query plus optional structured day attributes. */
export interface JournalArchiveFilters {
  query: string;
  bookmarked: JournalArchiveTriFilter;
  hasPhotos: JournalArchiveTriFilter;
  hasVideo: JournalArchiveTriFilter;
  hasPlaces: JournalArchiveTriFilter;
}

export const DEFAULT_JOURNAL_ARCHIVE_FILTERS: JournalArchiveFilters = {
  query: "",
  bookmarked: "any",
  hasPhotos: "any",
  hasVideo: "any",
  hasPlaces: "any",
};

export function cycleJournalArchiveTriFilter(
  value: JournalArchiveTriFilter
): JournalArchiveTriFilter {
  if (value === "any") return "yes";
  if (value === "yes") return "no";
  return "any";
}

export function journalArchiveFiltersAreActive(
  filters: JournalArchiveFilters
): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.bookmarked !== "any" ||
    filters.hasPhotos !== "any" ||
    filters.hasVideo !== "any" ||
    filters.hasPlaces !== "any"
  );
}

export function journalArchiveFiltersKey(filters: JournalArchiveFilters): string {
  return [
    filters.query.trim(),
    filters.bookmarked,
    filters.hasPhotos,
    filters.hasVideo,
    filters.hasPlaces,
  ].join("\0");
}

function matchesTriFilter(
  value: boolean,
  filter: JournalArchiveTriFilter
): boolean {
  if (filter === "any") return true;
  if (filter === "yes") return value;
  return !value;
}

/** Text query + structured filters (hearted, photos, video, places). */
export function journalEntryMatchesFilters(
  entry: JournalEntry,
  filters: JournalArchiveFilters,
  locale: LocaleValue
): boolean {
  if (!journalEntryMatchesQuery(entry, filters.query, locale)) return false;

  const hasPhotos = Boolean(entry.photo_paths && entry.photo_paths.length > 0);
  const hasVideo = Boolean(
    entry.video_path?.trim() || entry.video_thumbnail?.trim()
  );
  const hasPlaces = Boolean(entry.location?.locations?.length);

  return (
    matchesTriFilter(Boolean(entry.is_bookmarked), filters.bookmarked) &&
    matchesTriFilter(hasPhotos, filters.hasPhotos) &&
    matchesTriFilter(hasVideo, filters.hasVideo) &&
    matchesTriFilter(hasPlaces, filters.hasPlaces)
  );
}

export type JournalArchiveItem =
  | { kind: "month"; key: string; year: number; month: number }
  | { kind: "holiday"; key: string; name: string; date: string }
  | { kind: "entry"; entry: JournalEntry; holiday: string | null };

/**
 * Build a newest-first feed with month and holiday banners.
 */
export function buildJournalArchiveFeed(
  entries: JournalEntry[],
  locale: LocaleValue
): JournalArchiveItem[] {
  const sorted = [...entries].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date)
  );

  const items: JournalArchiveItem[] = [];
  let lastMonthKey = "";

  for (const entry of sorted) {
    const year = Number(entry.entry_date.slice(0, 4));
    const month = Number(entry.entry_date.slice(5, 7));
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    if (monthKey !== lastMonthKey) {
      items.push({ kind: "month", key: monthKey, year, month });
      lastMonthKey = monthKey;
    }

    const holiday = getHolidayName(entry.entry_date, locale);
    if (holiday) {
      items.push({
        kind: "holiday",
        key: `h-${entry.entry_date}-${holiday}`,
        name: holiday,
        date: entry.entry_date,
      });
    }

    items.push({
      kind: "entry",
      entry,
      holiday,
    });
  }

  return items;
}

export const JOURNAL_ARCHIVE_PAGE_SIZE = 12;

export function formatArchiveMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(getActiveLocaleTag(), {
    month: "long",
    year: "numeric",
  });
}

/** One map pin per journal day that has at least one geocoded place. */
export interface JournalArchiveMapPin {
  entryId: string;
  entryDate: string;
  displayName: string;
  lat: number;
  lon: number;
  dayEmoji: string | null;
  title: string | null;
}

/**
 * Collect pins for the archive world map (newest entries first).
 * Uses the first place with coordinates on each day.
 */
export function collectJournalArchiveMapPins(
  entries: JournalEntry[]
): JournalArchiveMapPin[] {
  const pins: JournalArchiveMapPin[] = [];
  const sorted = [...entries].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date)
  );

  for (const entry of sorted) {
    const places = entry.location?.locations ?? [];
    const place = places.find(
      (loc) =>
        loc.lat != null &&
        loc.lon != null &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lon)
    );
    if (!place || place.lat == null || place.lon == null) continue;
    pins.push({
      entryId: entry.id,
      entryDate: entry.entry_date,
      displayName: place.displayName,
      lat: place.lat,
      lon: place.lon,
      dayEmoji: entry.day_emoji,
      title: entry.title,
    });
  }

  return pins;
}
