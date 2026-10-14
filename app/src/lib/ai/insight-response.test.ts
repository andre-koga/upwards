import { describe, expect, it } from "vitest";
import { readInsightAnswer } from "./insight-response";

const habits = [
  { key: "1", id: "id-run", name: "Morning run" },
  { key: "2", id: "id-read", name: "Read" },
];

describe("readInsightAnswer", () => {
  it("resolves each suggestion's key to the habit on this device", () => {
    const answer = readInsightAnswer(
      {
        summary: "  A steady week.  ",
        suggestions: [
          { key: "2", text: " Read after dinner. " },
          { key: "1", text: "Shoes by the door." },
        ],
      },
      habits
    );
    expect(answer).toEqual({
      summary: "A steady week.",
      suggestions: [
        {
          key: "2",
          activityId: "id-read",
          name: "Read",
          text: "Read after dinner.",
        },
        {
          key: "1",
          activityId: "id-run",
          name: "Morning run",
          text: "Shoes by the door.",
        },
      ],
      legacyRecommendations: [],
    });
  });

  it("drops a suggestion about a habit that was not in the request", () => {
    const answer = readInsightAnswer(
      {
        suggestions: [
          { key: "7", text: "Ghost." },
          { key: "1", text: "Real." },
        ],
      },
      habits
    );
    expect(answer.suggestions.map((s) => s.key)).toEqual(["1"]);
  });

  it("keeps one suggestion per habit and skips empty or malformed rows", () => {
    const answer = readInsightAnswer(
      {
        suggestions: [
          { key: "1", text: "First." },
          { key: "1", text: "Second." },
          { key: "2", text: "   " },
          { key: 2, text: "Numeric key." },
          null,
          "x",
        ],
      },
      habits
    );
    expect(answer.suggestions.map((s) => s.text)).toEqual(["First."]);
  });

  it("gives an empty summary when the AI gave none", () => {
    expect(
      readInsightAnswer({ summary: null, suggestions: [] }, habits).summary
    ).toBe("");
    expect(readInsightAnswer({ suggestions: [] }, habits).summary).toBe("");
  });

  it("reads the older recommendations list when the function has no suggestions field", () => {
    const answer = readInsightAnswer(
      { summary: "Fine.", recommendations: ["Do more.", 7, "Sleep."] },
      habits
    );
    expect(answer.suggestions).toEqual([]);
    expect(answer.legacyRecommendations).toEqual(["Do more.", "Sleep."]);
  });

  it("does not read recommendations when suggestions are present, even if empty", () => {
    const answer = readInsightAnswer(
      { suggestions: [], recommendations: ["Ignored."] },
      habits
    );
    expect(answer.legacyRecommendations).toEqual([]);
  });

  it("survives an answer that is not an object", () => {
    expect(readInsightAnswer(null, habits)).toEqual({
      summary: "",
      suggestions: [],
      legacyRecommendations: [],
    });
    expect(readInsightAnswer("nope", habits).suggestions).toEqual([]);
  });
});
