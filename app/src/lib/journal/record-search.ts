import { db } from "@/lib/db";
import type { JournalEntry, Memory } from "@/lib/db/types";
import type { BirthdayContext, CalendarId } from "@/lib/holidays";
import type { LocaleValue } from "@/lib/i18n/locale-storage";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";
import {
  DEFAULT_JOURNAL_ARCHIVE_FILTERS,
  journalEntryHasContent,
  journalEntryMatchesQuery,
} from "./archive";
import { memoryMatchesFilters, recordMemories } from "./record";

/** Fewest characters before the palette searches the record at all. */
export const RECORD_SEARCH_MIN_LENGTH = 2;

export interface RecordHit {
  kind: "entry" | "memory";
  /** A day's `entry_date`, or a memory's id. */
  id: string;
  title: string;
  /** Where it sits in the record: the date, or the memory's own words for when. */
  detail: string;
  emoji: string | null;
}

export interface RecordSearchContext {
  locale: LocaleValue;
  calendars: readonly CalendarId[];
  birthday?: BirthdayContext;
  /** Shown for a day or memory with no title of its own. */
  untitled: string;
  untitledMemory: string;
}

function firstLine(text: string | null | undefined): string {
  return (text ?? "").trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
}

function clip(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function entryHit(entry: JournalEntry, ctx: RecordSearchContext): RecordHit {
  const date = fromDateString(entry.entry_date);
  return {
    kind: "entry",
    id: entry.entry_date,
    title:
      clip(entry.title?.trim() ?? "") ||
      clip(firstLine(entry.text_content)) ||
      ctx.untitled,
    detail: `${formatWeekdayShortDate(date)} ${date.getFullYear()}`,
    emoji: entry.day_emoji?.trim() || null,
  };
}

function memoryHit(memory: Memory, ctx: RecordSearchContext): RecordHit {
  return {
    kind: "memory",
    id: memory.id,
    title: clip(firstLine(memory.text_content)) || ctx.untitledMemory,
    detail: memory.time_label?.trim() ?? "",
    emoji: null,
  };
}

/**
 * Days and memories that match what was typed, with the same rules the Journal
 * search uses (title, text, emoji, places, date, holiday). Days come newest
 * first, then memories; the two share `limit` so neither crowds the other out.
 */
export function searchRecordRows(
  entries: readonly JournalEntry[],
  memories: readonly Memory[],
  query: string,
  ctx: RecordSearchContext,
  limit = 8
): RecordHit[] {
  if (query.trim().length < RECORD_SEARCH_MIN_LENGTH) return [];

  const memoryFilters = { ...DEFAULT_JOURNAL_ARCHIVE_FILTERS, query };
  const days = entries
    .filter(
      (entry) =>
        journalEntryHasContent(entry) &&
        journalEntryMatchesQuery(
          entry,
          query,
          ctx.locale,
          ctx.calendars,
          ctx.birthday
        )
    )
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const kept = recordMemories(memories).filter((memory) =>
    memoryMatchesFilters(memory, memoryFilters)
  );

  const memoryQuota = Math.min(kept.length, Math.max(2, Math.floor(limit / 3)));
  const dayQuota = Math.min(days.length, limit - memoryQuota);
  const memoryRoom = Math.min(kept.length, limit - dayQuota);

  return [
    ...days.slice(0, dayQuota).map((entry) => entryHit(entry, ctx)),
    ...kept.slice(0, memoryRoom).map((memory) => memoryHit(memory, ctx)),
  ];
}

export async function searchRecord(
  query: string,
  ctx: RecordSearchContext,
  limit = 8
): Promise<RecordHit[]> {
  if (query.trim().length < RECORD_SEARCH_MIN_LENGTH) return [];
  const [entries, memories] = await Promise.all([
    db.journalEntries.toArray(),
    db.memories.toArray(),
  ]);
  return searchRecordRows(entries, memories, query, ctx, limit);
}
