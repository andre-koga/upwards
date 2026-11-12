import { describe, expect, it } from "vitest";
import {
  MAX_DAYS,
  parseReading,
  parseReadingRequest,
  readingSystemPrompt,
  readingUserMessage,
} from "../../../../supabase/functions/_shared/journal-personality";

const day = (date: string, title = "T", text = "Some words") => ({
  date,
  title,
  text,
});

describe("parseReadingRequest", () => {
  it("accepts days and defaults the locale to English", () => {
    const request = parseReadingRequest({ days: [day("2026-11-01")] });
    expect(request).toEqual({
      locale: "en",
      days: [{ date: "2026-11-01", title: "T", text: "Some words" }],
    });
    expect(
      parseReadingRequest({ locale: "pt", days: [day("2026-11-01")] })?.locale
    ).toBe("pt");
  });

  it("drops empty days and repeated dates, and caps text", () => {
    const request = parseReadingRequest({
      days: [
        day("2026-11-01", "", "  "),
        day("2026-11-02", "A", "x".repeat(900)),
        day("2026-11-02", "B", "again"),
      ],
    });
    expect(request?.days).toHaveLength(1);
    expect(request?.days[0].title).toBe("A");
    expect(request?.days[0].text).toHaveLength(300);
  });

  it("refuses too many days, bad dates, bad shapes and nothing to read", () => {
    const many = Array.from({ length: MAX_DAYS + 1 }, (_, i) =>
      day(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`)
    );
    expect(parseReadingRequest({ days: many })).toBeNull();
    expect(parseReadingRequest({ days: [day("11/01/2026")] })).toBeNull();
    expect(parseReadingRequest({ days: [{ date: "2026-11-01" }] })).toBeNull();
    expect(parseReadingRequest({ days: [] })).toBeNull();
    expect(
      parseReadingRequest({ days: [day("2026-11-01", "", "")] })
    ).toBeNull();
    expect(parseReadingRequest(null)).toBeNull();
    expect(parseReadingRequest({})).toBeNull();
  });

  it("builds a message with the days and nothing else", () => {
    const request = parseReadingRequest({
      days: [day("2026-11-01")],
      birthday: "1990-01-01",
      name: "Ada",
    })!;
    const message = readingUserMessage(request);
    expect(message).not.toContain("1990");
    expect(message).not.toContain("Ada");
    expect(JSON.parse(message)).toEqual({ days: request.days });
  });

  it("asks for the note in the reader's language", () => {
    expect(readingSystemPrompt("pt")).toContain("Brazilian Portuguese");
    expect(readingSystemPrompt("en")).toContain("English");
  });
});

const trait = (score: unknown, extra: Record<string, unknown> = {}) => ({
  score,
  note: "A note.",
  quotes: [],
  ...extra,
});
const answer = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    traits: {
      openness: trait(60),
      conscientiousness: trait(40),
      extraversion: trait(50),
      agreeableness: trait(70),
      neuroticism: trait(30),
      ...overrides,
    },
  });

describe("parseReading", () => {
  it("reads five scores, notes and quotes", () => {
    const reading = parseReading(
      answer({ openness: trait(61.6, { quotes: ["a", "b", "c"] }) })
    );
    expect(reading?.scores.openness).toBe(62);
    expect(reading?.notes.openness).toBe("A note.");
    expect(reading?.quotes.openness).toEqual(["a", "b"]);
    expect(reading?.quotes.agreeableness).toBeUndefined();
  });

  it("reads JSON inside a markdown fence", () => {
    expect(
      parseReading("```json\n" + answer() + "\n```")?.scores.neuroticism
    ).toBe(30);
  });

  it("clamps scores to 0-100 and accepts numeric strings", () => {
    const reading = parseReading(
      answer({
        openness: trait(140),
        neuroticism: trait(-5),
        extraversion: trait("45"),
      })
    );
    expect(reading?.scores.openness).toBe(100);
    expect(reading?.scores.neuroticism).toBe(0);
    expect(reading?.scores.extraversion).toBe(45);
  });

  it("returns null when a trait is missing or has no usable score", () => {
    expect(parseReading(answer({ openness: trait("high") }))).toBeNull();
    expect(parseReading(answer({ openness: undefined }))).toBeNull();
    expect(parseReading(answer({ openness: trait(null) }))).toBeNull();
  });

  it("returns null for text that is not the expected JSON", () => {
    expect(parseReading("I think you are open.")).toBeNull();
    expect(parseReading('{"order": []}')).toBeNull();
  });

  it("drops non-string, empty and over-long quotes", () => {
    const reading = parseReading(
      answer({
        openness: trait(50, {
          quotes: [7, "", "   ", "x".repeat(300), "fine"],
        }),
      })
    );
    expect(reading?.quotes.openness).toEqual(["fine"]);
  });
});
