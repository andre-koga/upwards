const DISMISSED_KEY = "okhabit:ai_insight_dismissed";
/** Only the latest insight's dismissals matter; keep the list from growing. */
const MAX_KEPT = 40;

/**
 * A suggestion is dismissed for the insight it came in, not for good: a new
 * insight is new advice. The id is the insight's time plus the suggestion's
 * key. Local only, never synced.
 */
export function suggestionId(generatedAt: string, key: string): string {
  return `${generatedAt}#${key}`;
}

export function getDismissedSuggestions(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : []
    );
  } catch {
    return new Set();
  }
}

export function dismissSuggestion(id: string): Set<string> {
  const next = [...getDismissedSuggestions(), id].slice(-MAX_KEPT);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the dismissal lasts until the page is closed.
  }
  return new Set(next);
}
