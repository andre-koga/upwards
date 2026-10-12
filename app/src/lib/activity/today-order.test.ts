import { describe, expect, it } from "vitest";
import { orderActivitiesForToday } from "./today-order";

let created = 0;
function activity(
  id: string,
  over: Partial<{
    routine: string;
    completion_target: number;
    is_pinned: boolean;
    order_index: number | null;
  }> = {}
) {
  created += 1;
  return {
    id,
    routine: "daily",
    completion_target: 1,
    is_pinned: false,
    order_index: null as number | null,
    created_at: new Date(2026, 0, created).toISOString(),
    ...over,
  };
}

const ids = (list: { id: string }[]) => list.map((a) => a.id);

describe("orderActivitiesForToday", () => {
  it("puts pinned first, then not-done, then done", () => {
    const list = [
      activity("done", { order_index: 0 }),
      activity("open", { order_index: 1 }),
      activity("pinned", { order_index: 2, is_pinned: true }),
    ];
    expect(ids(orderActivitiesForToday(list, { done: 1 }))).toEqual([
      "pinned",
      "open",
      "done",
    ]);
  });

  it("keeps pinned items above everything, done or not, open ones first", () => {
    const list = [
      activity("a", { order_index: 0 }),
      activity("pinDone", { order_index: 1, is_pinned: true }),
      activity("pinOpen", { order_index: 2, is_pinned: true }),
    ];
    expect(ids(orderActivitiesForToday(list, { pinDone: 1 }))).toEqual([
      "pinOpen",
      "pinDone",
      "a",
    ]);
  });

  it("uses order_index inside a band, then creation time", () => {
    const list = [
      activity("late", { order_index: 5 }),
      activity("early", { order_index: 1 }),
      activity("unindexed-old"),
      activity("unindexed-new"),
    ];
    expect(ids(orderActivitiesForToday(list, {}))).toEqual([
      "early",
      "late",
      "unindexed-old",
      "unindexed-new",
    ]);
  });

  it("counter habits are done only at their target", () => {
    const list = [
      activity("water", { order_index: 0, completion_target: 8 }),
      activity("walk", { order_index: 1 }),
    ];
    expect(ids(orderActivitiesForToday(list, { water: 7 }))).toEqual([
      "water",
      "walk",
    ]);
    expect(ids(orderActivitiesForToday(list, { water: 8 }))).toEqual([
      "walk",
      "water",
    ]);
  });

  it("never treats an avoid habit as done, even after slips", () => {
    const list = [
      activity("avoid", { routine: "never" }),
      activity("habit", { order_index: 0 }),
    ];
    expect(ids(orderActivitiesForToday(list, { avoid: 3 }))).toEqual([
      "habit",
      "avoid",
    ]);
    expect(ids(orderActivitiesForToday(list, { habit: 1, avoid: 3 }))).toEqual([
      "avoid",
      "habit",
    ]);
  });

  it("does not mutate its input", () => {
    const list = [
      activity("b", { order_index: 1 }),
      activity("a", { order_index: 0 }),
    ];
    const copy = [...list];
    orderActivitiesForToday(list, {});
    expect(list).toEqual(copy);
  });
});
