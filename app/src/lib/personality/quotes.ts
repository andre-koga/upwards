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
