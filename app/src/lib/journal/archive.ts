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

export type JournalArchiveItem =
  | { kind: "year"; key: string; year: number }
  | { kind: "month"; key: string; year: number; month: number }
  | { kind: "holiday"; key: string; name: string; date: string }
  | { kind: "entry"; entry: JournalEntry; holiday: string | null };

/**
 * Build a newest-first feed with year, month, and holiday banners.
 */
export function buildJournalArchiveFeed(
  entries: JournalEntry[],
  locale: LocaleValue
): JournalArchiveItem[] {
  const sorted = [...entries].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date)
  );

  const items: JournalArchiveItem[] = [];
  let lastYear: number | null = null;
  let lastMonthKey = "";

  for (const entry of sorted) {
    const year = Number(entry.entry_date.slice(0, 4));
    const month = Number(entry.entry_date.slice(5, 7));
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    if (lastYear !== year) {
      items.push({ kind: "year", key: `y-${year}`, year });
      lastYear = year;
      lastMonthKey = "";
    }

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
  });
}

export function formatArchiveYearLabel(year: number): string {
  return String(year);
}
