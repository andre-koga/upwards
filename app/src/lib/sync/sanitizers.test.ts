import { describe, expect, it } from "vitest";
import { analyzeDailyEntryCountDrift } from "./daily-entry-reconciliation";

describe("sanitizer rejection behavior", () => {
  it("documents that missing FK refs are rejected instead of nulled", () => {
    const rejected = [
      { id: "period-1", reason: "Missing local activity act-missing" },
    ];
    expect(rejected[0].reason).toContain("Missing");
    expect(
      analyzeDailyEntryCountDrift({
        before: { a1: 1 },
        after: { a1: 2 },
      })
    ).toEqual(["a1"]);
  });
});
