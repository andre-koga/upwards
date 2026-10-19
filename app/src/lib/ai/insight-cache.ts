import type { InsightSuggestion } from "@/lib/ai/insight-response";

const CACHE_KEY = "okhabit:ai_insight_cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedInsight {
  generatedAt: string; // ISO timestamp
  fingerprint: string;
  /** Empty when the AI gave none its figures back; Home then says it itself. */
  summary: string;
  /**
   * Plain suggestions that name no habit: from an insight made before
   * suggestions were tied to one. Empty for a new insight.
   */
  recommendations: string[];
  /** Absent in an insight cached before suggestions were tied to a habit. */
  suggestions?: InsightSuggestion[];
}

function isSuggestion(value: unknown): value is InsightSuggestion {
  const v = value as Partial<InsightSuggestion> | null;
  return (
    !!v &&
    typeof v.key === "string" &&
    typeof v.activityId === "string" &&
    typeof v.name === "string" &&
    typeof v.text === "string"
  );
}

/** Local-only cache — never synced. */
export function getCachedInsight(): CachedInsight | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedInsight;
    if (
      typeof parsed?.generatedAt !== "string" ||
      typeof parsed?.fingerprint !== "string" ||
      typeof parsed?.summary !== "string" ||
      !Array.isArray(parsed?.recommendations)
    ) {
      return null;
    }
    // A malformed suggestions list is dropped, not the whole insight.
    return {
      ...parsed,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter(isSuggestion)
        : undefined,
    };
  } catch {
    return null;
  }
}

export function setCachedInsight(insight: CachedInsight): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(insight));
}

/** True when the cache matches the current stats fingerprint and is under 24h old. */
export function isCacheFresh(
  cache: CachedInsight | null,
  fingerprint: string
): boolean {
  if (!cache || cache.fingerprint !== fingerprint) return false;
  const age = Date.now() - new Date(cache.generatedAt).getTime();
  return age >= 0 && age < CACHE_TTL_MS;
}
