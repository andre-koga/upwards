/** A day whose words were sent for a journal reading. */
export interface SentDay {
  date: string;
  title: string;
  text: string;
}

/**
 * Keeps a quote only when it appears word for word in a day that was sent.
 * A model can invent or tidy a quote; the page must never show one that the
 * person did not write.
 */
export function verifiedQuotes(
  quotes: readonly unknown[],
  sentDays: readonly SentDay[]
): string[] {
  const haystacks = sentDays.flatMap((day) => [day.text, day.title]);
  const kept: string[] = [];
  for (const quote of quotes) {
    if (typeof quote !== "string") continue;
    if (quote.trim().length === 0) continue;
    if (kept.includes(quote)) continue;
    if (haystacks.some((text) => text.includes(quote))) kept.push(quote);
  }
  return kept;
}

/** One quote from a reading, and the written day it came from, if still there. */
export interface QuoteSource {
  quote: string;
  /** YYYY-MM-DD of the newest day that still holds the quote, or null. */
  date: string | null;
}

interface WrittenDay {
  entry_date: string;
  title: string | null;
  text_content: string | null;
  deleted_at: string | null;
}

/**
 * Finds where each quote was written. A reading stores only the words, so the
 * day is looked up in the journal as it is now; a day edited or deleted since
 * leaves the quote with no date rather than a wrong one.
 */
export function quoteSources(
  quotes: readonly string[],
  entries: readonly WrittenDay[]
): QuoteSource[] {
  const live = entries
    .filter((entry) => !entry.deleted_at)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  return quotes.map((quote) => {
    const match = live.find(
      (entry) =>
        (entry.text_content ?? "").includes(quote) ||
        (entry.title ?? "").includes(quote)
    );
    return { quote, date: match ? match.entry_date : null };
  });
}
