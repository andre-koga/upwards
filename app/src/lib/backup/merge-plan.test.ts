import { describe, expect, it } from "vitest";
import type { DailyEntry, JournalEntry } from "@/lib/db/types";
import {
  decideCurrentStateRow,
  planDailyEntryMerge,
  planJournalMerge,
  rowsEquivalent,
} from "./merge-plan";

function day(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    id: "day-1",
    date: "2026-09-01",
    task_counts: {},
    paused_task_ids: [],
    is_break_day: false,
    current_activity_id: null,
    completion_notes: {},
    completion_times: {},
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function journal(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "journal-1",
    entry_date: "2026-09-01",
    title: null,
    text_content: null,
    day_emoji: null,
    is_bookmarked: false,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    is_journal_complete: false,
    journal_entry_number: null,
    journal_completion_streak: null,
    journal_completed_at: null,
    location: null,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("rowsEquivalent", () => {
  it("ignores sync bookkeeping and key order", () => {
    expect(
      rowsEquivalent(
        { id: "a", n: 1, synced_at: "x" },
        { n: 1, id: "a", synced_at: null }
      )
    ).toBe(true);
    expect(rowsEquivalent({ id: "a", n: 1 }, { id: "a", n: 2 })).toBe(false);
  });
});

describe("decideCurrentStateRow", () => {
  const row = { id: "a", name: "Run", updated_at: "2026-09-02T00:00:00.000Z" };

  it("inserts missing rows and skips identical ones", () => {
    expect(decideCurrentStateRow(undefined, row)).toBe("insert");
    expect(decideCurrentStateRow({ ...row, synced_at: "s" }, row)).toBe(
      "unchanged"
    );
  });

  it("applies only a newer backup revision", () => {
    const older = {
      ...row,
      name: "Walk",
      updated_at: "2026-09-01T00:00:00.000Z",
    };
    expect(decideCurrentStateRow(older, row)).toBe("update");
    expect(decideCurrentStateRow(row, older)).toBe("keep_local");
  });
});

describe("planDailyEntryMerge", () => {
  it("adds only the difference up to the backup count", () => {
    const plan = planDailyEntryMerge(
      day({ task_counts: { a: 1, b: 5 } }),
      day({ task_counts: { a: 3, b: 2, c: 1 } })
    );
    expect(plan.counts).toEqual([
      { activityId: "a", previousCount: 1, nextCount: 3 },
      { activityId: "c", previousCount: 0, nextCount: 1 },
    ]);
  });

  it("fills a missing completion time without changing the count", () => {
    const plan = planDailyEntryMerge(
      day({ task_counts: { a: 1 } }),
      day({
        task_counts: { a: 1 },
        completion_times: { a: "2026-09-01T09:00:00.000Z" },
      })
    );
    expect(plan.counts).toEqual([
      {
        activityId: "a",
        previousCount: 1,
        nextCount: 1,
        completionAt: "2026-09-01T09:00:00.000Z",
      },
    ]);
  });

  it("only fills pauses, break days, and notes that are missing", () => {
    const plan = planDailyEntryMerge(
      day({ paused_task_ids: ["a"], completion_notes: { a: "mine" } }),
      day({
        paused_task_ids: ["a", "b"],
        is_break_day: true,
        completion_notes: { a: "theirs", b: "new" },
      })
    );
    expect(plan.pauseActivityIds).toEqual(["b"]);
    expect(plan.enableBreakDay).toBe(true);
    expect(plan.notes).toEqual([{ activityId: "b", note: "new" }]);
  });

  it("is empty when the account already has the backup's day", () => {
    const backup = day({
      task_counts: { a: 2 },
      paused_task_ids: ["b"],
      completion_times: { a: "2026-09-01T09:00:00.000Z" },
    });
    const plan = planDailyEntryMerge(backup, backup);
    expect(plan.counts).toEqual([]);
    expect(plan.pauseActivityIds).toEqual([]);
    expect(plan.enableBreakDay).toBe(false);
  });
});

describe("planJournalMerge", () => {
  const ts = "2026-10-01T00:00:00.000Z";

  it("flags different text on the same date as a conflict", () => {
    expect(
      planJournalMerge(
        journal({ text_content: "mine" }),
        journal({ text_content: "backup" }),
        ts
      ).kind
    ).toBe("conflict");
  });

  it("fills empty text and unions photos", () => {
    const decision = planJournalMerge(
      journal({ photo_paths: ["u/a.jpg"] }),
      journal({ text_content: "from backup", photo_paths: ["u/b.jpg"] }),
      ts
    );
    expect(decision.kind).toBe("update");
    if (decision.kind !== "update") return;
    expect(decision.row.text_content).toBe("from backup");
    expect(decision.row.photo_paths).toEqual(["u/a.jpg", "u/b.jpg"]);
    expect(decision.row.updated_at).toBe(ts);
  });

  it("is unchanged once the merge has been applied", () => {
    const local = journal({ photo_paths: ["u/a.jpg"] });
    const backup = journal({ text_content: "t", photo_paths: ["u/b.jpg"] });
    const first = planJournalMerge(local, backup, ts);
    if (first.kind !== "update") throw new Error("expected update");
    expect(planJournalMerge(first.row, backup, ts).kind).toBe("unchanged");
  });

  it("matches the local entry for the date regardless of id", () => {
    expect(
      planJournalMerge(
        journal({ id: "natural", text_content: "same" }),
        journal({ id: "legacy", text_content: "same" }),
        ts
      ).kind
    ).toBe("unchanged");
  });
});
