import { db, newId, now } from "@/lib/db";
import type { JournalReading, PersonalityScores } from "@/lib/db/types";
import {
  requestJournalReading,
  type ParsedReading,
} from "@/lib/ai/journal-reading-client";
import { saveJournalReading } from "@/lib/sync/mutate-synced";
import { TRAITS } from "./items";
import { verifiedQuotes, type SentDay } from "./quotes";

/** What the edge function accepts: the limits are mirrored there. */
export const READING_MAX_DAYS = 60;
export const READING_MAX_TEXT_CHARS = 300;
export const READING_MAX_TITLE_CHARS = 80;

/**
 * The most recent written days, oldest first, cut to what will be sent. Only a
 * day with a title or text counts; photos, places and emoji are never sent.
 */
export async function collectReadingDays(
  limit = READING_MAX_DAYS
): Promise<SentDay[]> {
  const rows = await db.journalEntries.toArray();
  const days: SentDay[] = [];
  for (const row of rows) {
    if (row.deleted_at) continue;
    const title = (row.title ?? "").trim().slice(0, READING_MAX_TITLE_CHARS);
    const text = (row.text_content ?? "")
      .trim()
      .slice(0, READING_MAX_TEXT_CHARS);
    if (!title && !text) continue;
    days.push({ date: row.entry_date, title, text });
  }
  days.sort((a, b) => b.date.localeCompare(a.date));
  return days.slice(0, limit).reverse();
}

/** The newest reading that has not been deleted. */
export async function latestJournalReading(): Promise<JournalReading | null> {
  const rows = await db.journalReadings.toArray();
  const live = rows.filter((row) => !row.deleted_at);
  live.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return live[0] ?? null;
}

/**
 * Turns a model answer into a saved reading. Quotes are kept only when they are
 * word-for-word in a day that was sent; the rest are dropped, so a made-up
 * quote can never be shown.
 */
export function buildJournalReading(
  parsed: ParsedReading,
  sentDays: readonly SentDay[]
): JournalReading {
  const notes: JournalReading["notes"] = {};
  const quotes: JournalReading["quotes"] = {};
  for (const trait of TRAITS) {
    const note = parsed.notes[trait];
    if (note) notes[trait] = note;
    const kept = verifiedQuotes(parsed.quotes[trait] ?? [], sentDays);
    if (kept.length > 0) quotes[trait] = kept;
  }
  const dates = sentDays.map((day) => day.date).sort();
  const stamp = now();
  return {
    id: newId(),
    scores: parsed.scores as PersonalityScores,
    notes,
    quotes,
    span_start: dates[0],
    span_end: dates[dates.length - 1],
    days_read: sentDays.length,
    created_at: stamp,
    updated_at: stamp,
    synced_at: null,
    deleted_at: null,
  };
}

/** Sends `days` to the user's model, then saves and returns the reading. */
export async function readJournal(
  days: readonly SentDay[],
  locale: "en" | "pt"
): Promise<JournalReading> {
  if (days.length === 0) throw new Error("No days to read");
  const parsed = await requestJournalReading(days, locale);
  const reading = buildJournalReading(parsed, days);
  await saveJournalReading(reading, null);
  return reading;
}
