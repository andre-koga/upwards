import { describe, expect, it } from "vitest";
import {
  fingerprintPayload,
  parseInsightFigures,
  type InsightPayload,
} from "./build-insight-payload";

const payload: InsightPayload = {
  range: "7d",
  activities: [
    { name: "Run", targetPerDay: 1, completedDays: 5, totalDays: 7, streak: 4 },
  ],
  journal: { entriesThisWeek: 3, streak: 2, bookmarkedCount: 1 },
  completionRate: 0.71,
};

describe("parseInsightFigures", () => {
  it("recovers exactly what was sent from a fingerprint", () => {
    expect(parseInsightFigures(fingerprintPayload(payload))).toEqual(payload);
  });

  it("returns null for anything that is not a payload", () => {
    expect(parseInsightFigures("")).toBeNull();
    expect(parseInsightFigures("not json")).toBeNull();
    expect(parseInsightFigures("null")).toBeNull();
    expect(parseInsightFigures("[]")).toBeNull();
    expect(parseInsightFigures(JSON.stringify({ range: "7d" }))).toBeNull();
    expect(
      parseInsightFigures(JSON.stringify({ ...payload, activities: "x" }))
    ).toBeNull();
  });
});
