import { describe, expect, it } from "vitest";
import {
  MAX_RANK_ITEMS,
  MAX_REASON_LENGTH,
  groundedReason,
  parseRankRequest,
  parseRanking,
  rankSystemPrompt,
  type RankItem,
  type RankRequest,
} from "../../../../supabase/functions/_shared/rank-today";

function item(key: string, over: Partial<RankItem> = {}): RankItem {
  return {
    key,
    name: `Habit ${key}`,
    type: "habit",
    target: 1,
    doneToday: 0,
    daysDone: 5,
    daysActive: 7,
    streak: 3,
    minutes: 0,
    ...over,
  };
}

const request = (...keys: string[]): RankRequest => ({
  items: keys.map((key) => item(key)),
});

describe("parseRankRequest", () => {
  it("accepts well-formed items and trims names", () => {
    const parsed = parseRankRequest({
      items: [{ ...item("1"), name: "  Read  " }],
    });
    expect(parsed?.items[0].name).toBe("Read");
  });

  it.each([
    ["no body", null],
    ["no items", { items: [] }],
    ["items not an array", { items: "x" }],
    [
      "too many items",
      {
        items: Array.from({ length: MAX_RANK_ITEMS + 1 }, (_, i) =>
          item(String(i + 1))
        ),
      },
    ],
    ["duplicate keys", { items: [item("1"), item("1")] }],
    ["empty name", { items: [item("1", { name: " " })] }],
    ["unknown type", { items: [{ ...item("1"), type: "avoid" }] }],
    ["negative figure", { items: [item("1", { streak: -1 })] }],
    ["non-numeric figure", { items: [{ ...item("1"), daysDone: "5" }] }],
    ["overlong key", { items: [item("123456789")] }],
  ])("rejects %s", (_label, body) => {
    expect(parseRankRequest(body)).toBeNull();
  });

  it("caps an overlong name instead of rejecting it", () => {
    const parsed = parseRankRequest({
      items: [item("1", { name: "x".repeat(200) })],
    });
    expect(parsed?.items[0].name.length).toBeLessThanOrEqual(60);
  });
});

describe("groundedReason", () => {
  const subject = item("1", { daysDone: 5, daysActive: 7, streak: 3 });

  it("keeps a reason whose numbers are the item's own", () => {
    expect(groundedReason("Done 5 of the last 7 days", subject)).toBe(
      "Done 5 of the last 7 days"
    );
    expect(groundedReason("3-day streak to protect", subject)).not.toBeNull();
  });

  it("allows derived figures: days missed, hours tracked", () => {
    expect(
      groundedReason("Missed 2 of the last 7 days", subject)
    ).not.toBeNull();
    const timed = item("2", { type: "time-only", minutes: 90 });
    expect(groundedReason("About 1.5 hours this week", timed)).not.toBeNull();
    expect(groundedReason("90 minutes this week", timed)).not.toBeNull();
  });

  it("drops a reason with a number the data does not back", () => {
    expect(groundedReason("Done 6 of the last 7 days", subject)).toBeNull();
    expect(groundedReason("12-day streak", subject)).toBeNull();
  });

  it("drops a reason that names no figure", () => {
    expect(
      groundedReason("You usually do this in the morning", subject)
    ).toBeNull();
    expect(groundedReason("", subject)).toBeNull();
    expect(groundedReason(undefined, subject)).toBeNull();
    expect(groundedReason(7, subject)).toBeNull();
  });

  it("caps its length", () => {
    const long = `Done 5 of the last 7 days ${"and so on ".repeat(30)}`;
    expect(groundedReason(long, subject)!.length).toBeLessThanOrEqual(
      MAX_REASON_LENGTH
    );
  });
});

describe("parseRanking", () => {
  const req = request("1", "2", "3");

  it("returns the model's order with grounded reasons", () => {
    const raw = JSON.stringify({
      order: [
        { key: "3", reason: "Done 5 of the last 7 days" },
        { key: "1", reason: "3-day streak at stake" },
        { key: "2", reason: "Done 99 of the last 7 days" },
      ],
    });
    expect(parseRanking(raw, req)).toEqual([
      { key: "3", reason: "Done 5 of the last 7 days" },
      { key: "1", reason: "3-day streak at stake" },
      { key: "2", reason: null },
    ]);
  });

  it("reads JSON wrapped in a code fence", () => {
    const raw = '```json\n{"order":[{"key":"2","reason":"x"}]}\n```';
    expect(parseRanking(raw, req)?.map((r) => r.key)).toEqual(["2", "1", "3"]);
  });

  it("drops invented and repeated keys, and appends the ones it skipped", () => {
    const raw = JSON.stringify({
      order: [{ key: "9" }, { key: "2" }, { key: "2" }, { key: "1" }],
    });
    expect(parseRanking(raw, req)?.map((r) => r.key)).toEqual(["2", "1", "3"]);
  });

  it.each([
    ["not JSON", "here is your order: 3, 1, 2"],
    ["not an object", "[1,2]"],
    ["no order", '{"summary":"x"}'],
    ["order not an array", '{"order":"3,1,2"}'],
    ["no usable key", '{"order":[{"key":"9"},{"nope":1}]}'],
  ])("is null for %s", (_label, raw) => {
    expect(parseRanking(raw, req)).toBeNull();
  });
});

describe("rankSystemPrompt", () => {
  it("tells the model to use only the item's own figures", () => {
    expect(rankSystemPrompt()).toMatch(/never invent/i);
  });
});
