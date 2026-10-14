import { describe, expect, it } from "vitest";
import { buildDigest, type DigestHabit, type DigestInput } from "./digest";

function habit(
  id: string,
  figures: Partial<DigestHabit["figures"]> = {},
  over: Partial<DigestHabit> = {}
): DigestHabit {
  return {
    id,
    name: id,
    pinned: false,
    figures: {
      type: "habit",
      target: 1,
      doneToday: 0,
      daysDone: 7,
      daysActive: 7,
      streak: 0,
      ...figures,
    },
    ...over,
  };
}

const quiet = { writtenToday: true, streakBeforeToday: 0 };
const input = (
  habits: DigestHabit[],
  journal: DigestInput["journal"] = quiet
): DigestInput => ({ habits, journal });

describe("buildDigest", () => {
  it("is empty when nothing is slipping and nothing is at risk", () => {
    expect(
      buildDigest(input([habit("run", { streak: 2 }), habit("read")]))
    ).toEqual([]);
  });

  it("flags a long streak that is not done yet today", () => {
    const items = buildDigest(input([habit("run", { streak: 9 })]));
    expect(items).toEqual([
      expect.objectContaining({
        kind: "streak-at-risk",
        activityId: "run",
        streak: 9,
        doneToday: 0,
        target: 1,
      }),
    ]);
  });

  it("leaves a streak alone once today's target is met", () => {
    expect(
      buildDigest(input([habit("run", { streak: 9, doneToday: 1 })]))
    ).toEqual([]);
  });

  it("needs a real streak: two days is not yet worth a warning", () => {
    expect(buildDigest(input([habit("run", { streak: 2 })]))).toEqual([]);
    expect(buildDigest(input([habit("run", { streak: 3 })]))).toHaveLength(1);
  });

  it("flags a habit that has been slipping, with its own figures", () => {
    const items = buildDigest(
      input([habit("stretch", { daysDone: 2, daysActive: 7 })])
    );
    expect(items).toEqual([
      expect.objectContaining({
        kind: "slipping",
        activityId: "stretch",
        daysDone: 2,
        daysActive: 7,
      }),
    ]);
  });

  it("does not call a young habit slipping on a few chances", () => {
    expect(
      buildDigest(input([habit("new", { daysDone: 0, daysActive: 3 })]))
    ).toEqual([]);
    expect(
      buildDigest(input([habit("new", { daysDone: 0, daysActive: 4 })]))
    ).toHaveLength(1);
  });

  it("does not nag about a slipping habit already done today", () => {
    expect(
      buildDigest(
        input([habit("stretch", { daysDone: 1, daysActive: 7, doneToday: 1 })])
      )
    ).toEqual([]);
  });

  it("counts a habit once: a streak at risk is not also slipping", () => {
    const items = buildDigest(
      input([habit("run", { streak: 5, daysDone: 2, daysActive: 7 })])
    );
    expect(items.map((i) => i.kind)).toEqual(["streak-at-risk"]);
  });

  it("ignores time-only activities, which have no daily target to miss", () => {
    expect(
      buildDigest(input([habit("deep work", { type: "time-only", streak: 9 })]))
    ).toEqual([]);
  });

  it("warns about a journal streak when today is not written", () => {
    const items = buildDigest(
      input([], { writtenToday: false, streakBeforeToday: 12 })
    );
    expect(items).toEqual([{ kind: "journal-streak", streak: 12 }]);
    expect(
      buildDigest(input([], { writtenToday: true, streakBeforeToday: 12 }))
    ).toEqual([]);
    expect(
      buildDigest(input([], { writtenToday: false, streakBeforeToday: 1 }))
    ).toEqual([]);
  });

  it("orders streaks first (longest first), then the journal, then slipping habits", () => {
    const items = buildDigest(
      input(
        [
          habit("slip", { daysDone: 1, daysActive: 7 }),
          habit("short", { streak: 4 }),
          habit("long", { streak: 20 }),
        ],
        { writtenToday: false, streakBeforeToday: 6 }
      )
    );
    expect(
      items.map((i) => (i.kind === "journal-streak" ? "journal" : i.name))
    ).toEqual(["long", "short", "journal", "slip"]);
  });

  it("orders slipping habits by how little they were done", () => {
    const items = buildDigest(
      input([
        habit("a", { daysDone: 2, daysActive: 7 }),
        habit("b", { daysDone: 0, daysActive: 7 }),
        habit("c", { daysDone: 1, daysActive: 7 }),
      ])
    );
    expect(items.map((i) => (i.kind === "slipping" ? i.name : ""))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("shows no more than four items", () => {
    const habits = Array.from({ length: 8 }, (_, i) =>
      habit(`h${i}`, { streak: 5 + i })
    );
    expect(buildDigest(input(habits))).toHaveLength(4);
    expect(buildDigest(input(habits), 2)).toHaveLength(2);
  });

  it("carries whether a habit is already pinned, so the action can differ", () => {
    const [item] = buildDigest(
      input([habit("run", { streak: 5 }, { pinned: true })])
    );
    expect(item).toMatchObject({ kind: "streak-at-risk", pinned: true });
  });
});
