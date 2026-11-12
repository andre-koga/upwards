import { describe, expect, it } from "vitest";
import { quoteSources } from "./quotes";

const entry = (
  date: string,
  text: string | null,
  title: string | null = null,
  deleted: string | null = null
) => ({
  entry_date: date,
  title,
  text_content: text,
  deleted_at: deleted,
});

describe("quoteSources", () => {
  it("finds the day a quote was written", () => {
    const result = quoteSources(
      ["half-formed ideas"],
      [
        entry("2026-11-01", "Slow day."),
        entry("2026-11-03", "I keep returning to half-formed ideas."),
      ]
    );
    expect(result).toEqual([
      { quote: "half-formed ideas", date: "2026-11-03" },
    ]);
  });

  it("matches a title as well as the text", () => {
    const result = quoteSources(
      ["Museum day"],
      [entry("2026-11-05", null, "Museum day")]
    );
    expect(result[0].date).toBe("2026-11-05");
  });

  it("prefers the newest day when two hold the quote", () => {
    const result = quoteSources(
      ["too tired"],
      [entry("2026-11-01", "too tired"), entry("2026-11-09", "too tired")]
    );
    expect(result[0].date).toBe("2026-11-09");
  });

  it("gives no date when the day was edited or deleted since", () => {
    const result = quoteSources(
      ["gone words", "edited words"],
      [
        entry("2026-11-01", "gone words", null, "2026-11-02"),
        entry("2026-11-03", "different now"),
      ]
    );
    expect(result.map((r) => r.date)).toEqual([null, null]);
  });

  it("keeps the order of the quotes", () => {
    const result = quoteSources(["b", "a"], [entry("2026-11-01", "a b")]);
    expect(result.map((r) => r.quote)).toEqual(["b", "a"]);
  });
});
