import { describe, expect, it } from "vitest";
import {
  INSIGHT_WINDOW_DAYS,
  MAX_INSIGHT_ACTIVITIES,
  MAX_SUGGESTIONS,
  MAX_SUGGESTION_LENGTH,
  groundedSuggestion,
  groundedSummary,
  insightSystemPrompt,
  parseInsight,
  parseInsightRequest,
  type InsightActivity,
  type InsightRequest,
} from "../../../../supabase/functions/_shared/insight";

function activity(
  key: string,
  over: Partial<InsightActivity> = {}
): InsightActivity {
  return {
    key,
    name: `Habit ${key}`,
    targetPerDay: 1,
    completedDays: 3,
    totalDays: 7,
    streak: 2,
    ...over,
  };
}

function request(over: Partial<InsightRequest> = {}): InsightRequest {
  return {
    range: "7d",
    activities: [activity("1"), activity("2", { completedDays: 6, streak: 9 })],
    journal: { entriesThisWeek: 4, streak: 5, bookmarkedCount: 1 },
    completionRate: 0.64,
    ...over,
  };
}

describe("parseInsightRequest", () => {
  it("accepts a well-formed request and trims and caps names", () => {
    const parsed = parseInsightRequest({
      ...request(),
      activities: [{ ...activity("1"), name: `  ${"x".repeat(80)}  ` }],
    });
    expect(parsed?.activities[0].name).toHaveLength(60);
    expect(parsed?.activities[0].name.endsWith("…")).toBe(true);
  });

  it("keys a habit by position when an older app sends no key", () => {
    const withoutKeys = {
      ...request(),
      activities: request().activities.map((item) => {
        const copy: Partial<InsightActivity> = { ...item };
        delete copy.key;
        return copy;
      }),
    };
    const parsed = parseInsightRequest(withoutKeys);
    expect(parsed?.activities.map((a) => a.key)).toEqual(["1", "2"]);
  });

  it.each([
    ["no body", null],
    ["not an object", "x"],
    ["wrong window", { ...request(), range: "30d" }],
    ["activities not an array", { ...request(), activities: "x" }],
    [
      "too many activities",
      {
        ...request(),
        activities: Array.from({ length: MAX_INSIGHT_ACTIVITIES + 1 }, (_, i) =>
          activity(String(i + 1))
        ),
      },
    ],
    [
      "a duplicate key",
      { ...request(), activities: [activity("1"), activity("1")] },
    ],
    [
      "an unnamed habit",
      { ...request(), activities: [activity("1", { name: " " })] },
    ],
    [
      "more days done than possible",
      {
        ...request(),
        activities: [activity("1", { completedDays: 8, totalDays: 7 })],
      },
    ],
    [
      "a negative figure",
      { ...request(), activities: [activity("1", { streak: -1 })] },
    ],
    [
      "a non-numeric figure",
      {
        ...request(),
        activities: [{ ...activity("1"), streak: "9" }],
      },
    ],
    ["no journal", { ...request(), journal: null }],
    ["a rate over 1", { ...request(), completionRate: 1.4 }],
    ["a rate that is not a number", { ...request(), completionRate: "x" }],
  ])("rejects %s", (_label, body) => {
    expect(parseInsightRequest(body)).toBeNull();
  });

  it("accepts no habits at all: a journal-only week is a valid request", () => {
    expect(parseInsightRequest(request({ activities: [] }))).not.toBeNull();
  });
});

describe("groundedSuggestion", () => {
  const run = activity("1", {
    name: "Morning run",
    completedDays: 5,
    totalDays: 7,
    streak: 4,
    targetPerDay: 1,
  });

  it("keeps advice that cites none of the figures", () => {
    expect(
      groundedSuggestion("Lay your shoes out the night before.", run)
    ).toBe("Lay your shoes out the night before.");
  });

  it("keeps a line whose numbers are that habit's own figures", () => {
    expect(groundedSuggestion("Done 5 of the last 7 days", run)).toBe(
      "Done 5 of the last 7 days"
    );
    expect(groundedSuggestion("A 4-day streak is worth keeping", run)).toBe(
      "A 4-day streak is worth keeping"
    );
    // The days it was missed, and the share, are derived from its own figures.
    expect(groundedSuggestion("You missed 2 days", run)).toBe(
      "You missed 2 days"
    );
    expect(groundedSuggestion("71% of days is a good base", run)).toBe(
      "71% of days is a good base"
    );
  });

  it("drops a line with a number that is not that habit's figure", () => {
    expect(groundedSuggestion("Done 6 of the last 7 days", run)).toBeNull();
    expect(groundedSuggestion("Try for a 30-day streak", run)).toBeNull();
  });

  it("drops a number that belongs to a different habit", () => {
    // 9 is Habit 2's streak, not this one's.
    const other = activity("2", { streak: 9 });
    expect(groundedSuggestion("Keep the 9-day streak going", run)).toBeNull();
    expect(groundedSuggestion("Keep the 9-day streak going", other)).not.toBe(
      null
    );
  });

  it("allows digits that are part of the habit's own name", () => {
    const read = activity("1", { name: "Read 20 pages", streak: 3 });
    expect(groundedSuggestion("Read your 20 pages after dinner", read)).toBe(
      "Read your 20 pages after dinner"
    );
    expect(groundedSuggestion("Read 25 pages after dinner", read)).toBeNull();
  });

  it("drops empty, blank and non-string lines", () => {
    expect(groundedSuggestion("", run)).toBeNull();
    expect(groundedSuggestion("   ", run)).toBeNull();
    expect(groundedSuggestion(7, run)).toBeNull();
    expect(groundedSuggestion(null, run)).toBeNull();
  });

  it("collapses whitespace and caps the length", () => {
    expect(groundedSuggestion("Lay   shoes\nout", run)).toBe("Lay shoes out");
    const long = groundedSuggestion("a".repeat(400), run) ?? "";
    expect(long).toHaveLength(MAX_SUGGESTION_LENGTH);
  });
});

describe("groundedSummary", () => {
  it("keeps a summary citing figures from anywhere in the request", () => {
    expect(
      groundedSummary("64% met, and a 9-day streak on Habit 2", request())
    ).not.toBeNull();
    expect(groundedSummary("A 5-day journal streak", request())).not.toBeNull();
  });

  it("keeps a summary with no numbers", () => {
    expect(groundedSummary("A steady week.", request())).toBe("A steady week.");
  });

  it("drops a summary citing a figure that was never given", () => {
    expect(groundedSummary("You hit 88% this week", request())).toBeNull();
    expect(groundedSummary("A 40-day streak", request())).toBeNull();
  });

  it("drops empty and non-string summaries", () => {
    expect(groundedSummary("", request())).toBeNull();
    expect(groundedSummary(undefined, request())).toBeNull();
  });
});

describe("parseInsight", () => {
  const req = request();
  const answer = (value: unknown) => JSON.stringify(value);

  it("returns the summary and the suggestions the figures back", () => {
    const parsed = parseInsight(
      answer({
        summary: "A steady week, 64% met.",
        suggestions: [
          { key: "1", text: "Done 3 of the last 7 days: try mornings." },
          { key: "2", text: "Keep the 9-day streak." },
        ],
      }),
      req
    );
    expect(parsed).toEqual({
      summary: "A steady week, 64% met.",
      suggestions: [
        { key: "1", text: "Done 3 of the last 7 days: try mornings." },
        { key: "2", text: "Keep the 9-day streak." },
      ],
    });
  });

  it("reads an answer wrapped in a code fence", () => {
    const fenced =
      "```json\n" +
      answer({ summary: "Fine.", suggestions: [{ key: "1", text: "Try." }] }) +
      "\n```";
    expect(parseInsight(fenced, req)?.suggestions).toHaveLength(1);
  });

  it("drops a suggestion about a key that was never sent", () => {
    const parsed = parseInsight(
      answer({
        summary: "Fine.",
        suggestions: [
          { key: "99", text: "Invented." },
          { key: "1", text: "Real." },
        ],
      }),
      req
    );
    expect(parsed?.suggestions.map((s) => s.key)).toEqual(["1"]);
  });

  it("keeps one suggestion per habit and no more than the limit", () => {
    const many = request({
      activities: Array.from({ length: 6 }, (_, i) => activity(String(i + 1))),
    });
    const parsed = parseInsight(
      answer({
        summary: "Fine.",
        suggestions: [
          { key: "1", text: "First." },
          { key: "1", text: "Second about the same habit." },
          ...Array.from({ length: 5 }, (_, i) => ({
            key: String(i + 2),
            text: `Step ${"for the habit"}.`,
          })),
        ],
      }),
      many
    );
    expect(parsed?.suggestions).toHaveLength(MAX_SUGGESTIONS);
    expect(new Set(parsed?.suggestions.map((s) => s.key)).size).toBe(
      MAX_SUGGESTIONS
    );
    expect(parsed?.suggestions[0].text).toBe("First.");
  });

  it("drops a suggestion whose figures do not back it, keeping the others", () => {
    const parsed = parseInsight(
      answer({
        summary: "Fine.",
        suggestions: [
          { key: "1", text: "Done 6 of the last 7 days." },
          { key: "2", text: "Keep the 9-day streak." },
        ],
      }),
      req
    );
    expect(parsed?.suggestions.map((s) => s.key)).toEqual(["2"]);
  });

  it("drops an unbacked summary but keeps the suggestions", () => {
    const parsed = parseInsight(
      answer({
        summary: "You hit 99% this week.",
        suggestions: [{ key: "1", text: "Try mornings." }],
      }),
      req
    );
    expect(parsed?.summary).toBeNull();
    expect(parsed?.suggestions).toHaveLength(1);
  });

  it("is valid, and says less, when nothing survives grounding", () => {
    const parsed = parseInsight(
      answer({
        summary: "You hit 99%.",
        suggestions: [{ key: "1", text: "A 50-day streak." }],
      }),
      req
    );
    expect(parsed).toEqual({ summary: null, suggestions: [] });
  });

  it("accepts a summary with no suggestions, and suggestions with no summary", () => {
    expect(parseInsight(answer({ summary: "Fine." }), req)).toEqual({
      summary: "Fine.",
      suggestions: [],
    });
    expect(
      parseInsight(answer({ suggestions: [{ key: "1", text: "Try." }] }), req)
        ?.summary
    ).toBeNull();
  });

  it.each([
    ["not JSON", "Here is your summary: great week!"],
    ["an array", "[1,2]"],
    ["a bare string", '"hello"'],
    ["an object with neither field", '{"foo": 1}'],
    ["null", "null"],
  ])("returns null for %s, which is an error to report", (_label, raw) => {
    expect(parseInsight(raw, req)).toBeNull();
  });

  it("ignores the old recommendations field: it cannot be tied to a habit", () => {
    const parsed = parseInsight(
      answer({ summary: "Fine.", recommendations: ["Do more."] }),
      req
    );
    expect(parsed?.suggestions).toEqual([]);
  });
});

describe("insightSystemPrompt", () => {
  it("names the window and the answer shape, and forbids invented figures", () => {
    const prompt = insightSystemPrompt();
    expect(prompt).toContain(`${INSIGHT_WINDOW_DAYS} days`);
    expect(prompt).toContain('"suggestions"');
    expect(prompt).toMatch(/never invent/i);
    expect(prompt).toMatch(/never raw journal text/i);
  });
});
