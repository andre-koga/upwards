import { describe, expect, it } from "vitest";
import {
  isOpOwnedProjectionTable,
  stripOpOwnedFields,
} from "./op-owned-fields";

describe("op-owned-fields", () => {
  it("keeps current activity definition fields on the row", () => {
    const row = {
      id: "a1",
      name: "Run",
      routine: "daily",
      completion_target: 1,
      group_id: "g1",
      order_index: 0,
      is_archived: false,
      completed_at: null,
      deleted_at: null,
    };
    expect(stripOpOwnedFields("activities", row)).toEqual(row);
  });

  it("strips count fields from daily_entries", () => {
    const stripped = stripOpOwnedFields("daily_entries", {
      id: "d1",
      date: "2026-08-01",
      task_counts: { a1: 2 },
      paused_task_ids: ["a1"],
      is_break_day: true,
      current_activity_id: "a1",
    });

    expect(stripped).toEqual({
      id: "d1",
      date: "2026-08-01",
      current_activity_id: "a1",
    });
  });

  it("identifies op-owned projection tables", () => {
    expect(isOpOwnedProjectionTable("daily_entries")).toBe(true);
    expect(isOpOwnedProjectionTable("activities")).toBe(false);
    expect(isOpOwnedProjectionTable("journal_entries")).toBe(false);
  });
});
