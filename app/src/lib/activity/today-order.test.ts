import { describe, expect, it } from "vitest";
import {
  canMoveActivity,
  orderActivitiesForToday,
  planActivityMove,
} from "./today-order";

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

describe("orderActivitiesForToday with an AI ranking", () => {
  const list = () => [
    activity("a", { order_index: 0 }),
    activity("b", { order_index: 1 }),
    activity("c", { order_index: 2 }),
    activity("d", { order_index: 3 }),
  ];

  it("orders the open rows by the ranking", () => {
    expect(
      ids(orderActivitiesForToday(list(), {}, ["c", "a", "b", "d"]))
    ).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps pins first and done rows last, whatever the ranking says", () => {
    const rows = [
      activity("a", { order_index: 0 }),
      activity("b", { order_index: 1, is_pinned: true }),
      activity("c", { order_index: 2 }),
      activity("d", { order_index: 3 }),
    ];
    expect(
      ids(orderActivitiesForToday(rows, { c: 1 }, ["c", "d", "a", "b"]))
    ).toEqual(["b", "d", "a", "c"]);
  });

  it("puts rows the ranking has not seen after it, in stored order", () => {
    expect(ids(orderActivitiesForToday(list(), {}, ["d", "b"]))).toEqual([
      "d",
      "b",
      "a",
      "c",
    ]);
  });

  it("ignores ids that are no longer on today's list", () => {
    expect(ids(orderActivitiesForToday(list(), {}, ["gone", "b"]))).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("is the plain order with an empty or missing ranking", () => {
    const plain = ids(orderActivitiesForToday(list(), {}));
    expect(ids(orderActivitiesForToday(list(), {}, []))).toEqual(plain);
  });
});

describe("orderActivitiesForToday with done habits kept in place", () => {
  it("leaves a done habit where the stored order puts it", () => {
    const list = [
      activity("a", { order_index: 0 }),
      activity("b", { order_index: 1 }),
      activity("c", { order_index: 2 }),
    ];
    expect(
      ids(
        orderActivitiesForToday(list, { a: 1 }, undefined, { doneLast: false })
      )
    ).toEqual(["a", "b", "c"]);
    expect(ids(orderActivitiesForToday(list, { a: 1 }))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("still puts pins first", () => {
    const list = [
      activity("a", { order_index: 0 }),
      activity("b", { order_index: 1, is_pinned: true }),
    ];
    expect(
      ids(orderActivitiesForToday(list, {}, undefined, { doneLast: false }))
    ).toEqual(["b", "a"]);
  });

  it("drops the AI ranking back to the stored order", () => {
    const list = [
      activity("a", { order_index: 0 }),
      activity("b", { order_index: 1 }),
      activity("c", { order_index: 2 }),
    ];
    expect(ids(orderActivitiesForToday(list, {}, ["c", "b", "a"]))).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(ids(orderActivitiesForToday(list, {}))).toEqual(["a", "b", "c"]);
  });
});

describe("planActivityMove", () => {
  const rows = () => [
    activity("a", { order_index: 0 }),
    activity("b", { order_index: 2 }),
    activity("hidden", { order_index: 3 }),
    activity("c", { order_index: 5 }),
  ];
  const today = (all: ReturnType<typeof rows>) =>
    all.filter((row) => row.id !== "hidden");

  it("swaps the numbers of two distinct neighbours", () => {
    const all = rows();
    const shown = orderActivitiesForToday(today(all), {});
    expect(planActivityMove(all, shown, "b", -1, {})).toEqual([
      { id: "b", order_index: 0 },
      { id: "a", order_index: 2 },
    ]);
    expect(planActivityMove(all, shown, "b", 1, {})).toEqual([
      { id: "b", order_index: 5 },
      { id: "c", order_index: 2 },
    ]);
  });

  it("does nothing at the ends of the list", () => {
    const all = rows();
    const shown = orderActivitiesForToday(today(all), {});
    expect(planActivityMove(all, shown, "a", -1, {})).toEqual([]);
    expect(planActivityMove(all, shown, "c", 1, {})).toEqual([]);
    expect(canMoveActivity(shown, "a", -1, {})).toBe(false);
    expect(canMoveActivity(shown, "a", 1, {})).toBe(true);
  });

  it("does not cross a pin or done band", () => {
    const all = [
      activity("pin", { order_index: 0, is_pinned: true }),
      activity("open", { order_index: 1 }),
      activity("done", { order_index: 2 }),
    ];
    const counts = { done: 1 };
    const shown = orderActivitiesForToday(all, counts);
    expect(planActivityMove(all, shown, "open", -1, counts)).toEqual([]);
    expect(planActivityMove(all, shown, "open", 1, counts)).toEqual([]);
    expect(canMoveActivity(shown, "open", 1, counts)).toBe(false);

    const inPlace = { doneLast: false };
    const flat = orderActivitiesForToday(all, counts, undefined, inPlace);
    expect(planActivityMove(all, flat, "open", 1, counts, inPlace)).toEqual([
      { id: "open", order_index: 2 },
      { id: "done", order_index: 1 },
    ]);
  });

  it("renumbers when rows tie or have no number, writing only changes", () => {
    const all = [
      activity("a", { order_index: 0 }),
      activity("b", { order_index: 1 }),
      activity("c", { order_index: 1 }),
      activity("avoid", { routine: "never" }),
    ];
    const shown = orderActivitiesForToday(all, {});
    expect(ids(shown)).toEqual(["a", "b", "c", "avoid"]);

    const patches = planActivityMove(all, shown, "c", -1, {});
    const next = all.map((row) => ({
      ...row,
      order_index:
        patches.find((patch) => patch.id === row.id)?.order_index ??
        row.order_index,
    }));
    expect(ids(orderActivitiesForToday(next, {}))).toEqual([
      "a",
      "c",
      "b",
      "avoid",
    ]);
    expect(patches.find((patch) => patch.id === "a")).toBeUndefined();

    const last = planActivityMove(all, shown, "avoid", -1, {});
    expect(last.length).toBeGreaterThan(0);
  });
});
