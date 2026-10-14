/** One thing the AI suggests, tied to one of the person's habits. */
export interface InsightSuggestion {
  /** The key the habit had in the request; unique within one insight. */
  key: string;
  /** The habit's id on this device. It never leaves the device. */
  activityId: string;
  /** The habit's name when the insight was made. */
  name: string;
  text: string;
}

/** A habit as it was keyed in the request. */
export interface InsightRequestHabit {
  key: string;
  id: string;
  name: string;
}

export interface InsightAnswer {
  /** Empty when the AI gave none the figures back; the app then says it itself. */
  summary: string;
  suggestions: InsightSuggestion[];
  /**
   * Suggestion texts from a function that predates habit-bound suggestions.
   * They cannot be tied to a habit, so they carry no action. Empty otherwise.
   */
  legacyRecommendations: string[];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * The function's answer as the app keeps it. A suggestion whose key was not in
 * the request is dropped, so one can never point at a habit the person does not
 * have. Reads the older `recommendations` list only when the answer has no
 * `suggestions` field at all (a function not yet redeployed).
 */
export function readInsightAnswer(
  data: unknown,
  habits: readonly InsightRequestHabit[]
): InsightAnswer {
  const body = (data ?? {}) as Record<string, unknown>;
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";

  if (!Array.isArray(body.suggestions)) {
    return {
      summary,
      suggestions: [],
      legacyRecommendations: strings(body.recommendations),
    };
  }

  const byKey = new Map(habits.map((habit) => [habit.key, habit]));
  const seen = new Set<string>();
  const suggestions: InsightSuggestion[] = [];
  for (const entry of body.suggestions) {
    const row = entry as { key?: unknown; text?: unknown } | null;
    const key = typeof row?.key === "string" ? row.key : "";
    const text = typeof row?.text === "string" ? row.text.trim() : "";
    const habit = byKey.get(key);
    if (!habit || !text || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      key,
      activityId: habit.id,
      name: habit.name,
      text,
    });
  }
  return { summary, suggestions, legacyRecommendations: [] };
}
