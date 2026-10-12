import { describe, expect, it } from "vitest";
import { buildRankFacts, pickRankCandidates } from "./build-rank-request";

let created = 0;
function activity(
  id: string,
  over: Partial<{
    name: string;
    routine: string;
    completion_target: number;
    is_pinned: boolean;
    order_index: number | null;
    created_at: string;
  }> = {}
) {
  created += 1;
  return {
    id,
    name: id,
    routine: "daily",
    completion_target: 1,
    is_pinned: false,
    order_index: created as number | null,
    created_at: "2026-01-01T12:00:00.000Z",
    ...over,
  };
}

describe("pickRankCandidates", () => {
  it("leaves out pinned, done and avoid rows", () => {
    const rows = [
      activity("open"),
      activity("pinned", { is_pinned: true }),
      activity("done"),
      activity("avoid", { routine: "never" }),
      activity("timed", { routine: "anytime" }),
    ];
    expect(pickRankCandidates(rows, { done: 1 }).map((a) => a.id)).toEqual([
      "open",
      "timed",
    ]);
  });

  it("caps the list", () => {
    const rows = Array.from({ length: 20 }, (_, i) => activity(`a${i}`));
    expect(pickRankCandidates(rows, {})).toHaveLength(12);
  });
});

describe("buildRankFacts", () => {
  const today = "2026-10-12";
  const entry = (date: string, counts: Record<string, number>, brk = false) =>
    ({
      id: date,
      date,
      task_counts: counts,
      is_break_day: brk,
    }) as never;

  it("counts the days the target was met in the seven days before today", () => {
    const read = { ...activity("read"), name: "Read" };
    const facts = buildRankFacts({
      candidates: [read],
      today,
      todayCounts: {},
      streaks: { read: 4 },
      entries: [
        entry("2026-10-11", { read: 1 }),
        entry("2026-10-10", { read: 1 }),
        entry("2026-10-09", {}),
        entry("2026-10-12", { read: 1 }), // today is outside the window
      ],
      periods: [],
    });
    expect(facts.items[0]).toMatchObject({
      key: "1",
      name: "Read",
      type: "habit",
      daysDone: 2,
      daysActive: 7,
      streak: 4,
      doneToday: 0,
    });
  });

  it("does not count break days, or days before the activity existed", () => {
    const fresh = activity("fresh", {
      created_at: "2026-10-09T12:00:00.000Z",
    });
    const facts = buildRankFacts({
      candidates: [fresh],
      today,
      todayCounts: {},
      streaks: {},
      entries: [entry("2026-10-10", {}, true)],
      periods: [],
    });
    // Oct 9, 10, 11 are after creation; Oct 10 is a break day.
    expect(facts.items[0].daysActive).toBe(2);
  });

  it("measures a timed activity by tracked days and minutes", () => {
    const run = activity("run", { routine: "anytime" });
    const facts = buildRankFacts({
      candidates: [run],
      today,
      todayCounts: {},
      streaks: { run: 9 },
      entries: [],
      periods: [
        {
          activity_id: "run",
          start_time: new Date(2026, 9, 11, 7, 0).toISOString(),
          end_time: new Date(2026, 9, 11, 7, 45).toISOString(),
        },
        {
          activity_id: "run",
          start_time: new Date(2026, 9, 9, 7, 0).toISOString(),
          end_time: new Date(2026, 9, 9, 7, 15).toISOString(),
        },
        {
          // Before the window: ignored.
          activity_id: "run",
          start_time: new Date(2026, 9, 1, 7, 0).toISOString(),
          end_time: new Date(2026, 9, 1, 8, 0).toISOString(),
        },
      ],
    });
    expect(facts.items[0]).toMatchObject({
      type: "time-only",
      minutes: 60,
      daysDone: 2,
      streak: 0,
    });
  });

  it("gives each candidate its own key in order", () => {
    const facts = buildRankFacts({
      candidates: [activity("a"), activity("b"), activity("c")],
      today,
      todayCounts: { b: 2 },
      streaks: {},
      entries: [],
      periods: [],
    });
    expect(facts.items.map((i) => i.key)).toEqual(["1", "2", "3"]);
    expect(facts.items[1].doneToday).toBe(2);
  });
});
