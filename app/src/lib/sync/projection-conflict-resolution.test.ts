import { describe, expect, it } from "vitest";
import { isDailyEntryCountReconciliationPayload } from "./daily-entry-reconciliation";
import { isProjectionConflictPayload } from "./projection-conflict-resolution";

describe("daily-entry-reconciliation", () => {
  it("recognizes reconciliation payload kind", () => {
    expect(
      isDailyEntryCountReconciliationPayload({
        kind: "daily_entry_count_reconciliation",
        entity_id: "e1",
        date: "2026-08-25",
        local_counts: {},
        remote_counts: {},
        suggested_counts: {},
        differing_activities: [],
      })
    ).toBe(true);
  });
});

describe("projection-conflict-resolution", () => {
  it("recognizes projection conflict payload kind", () => {
    expect(
      isProjectionConflictPayload({
        kind: "projection_conflict",
        entity_type: "activity_period",
        entity_id: "p1",
        entity_label: "Session",
        local: {
          device_id: "d1",
          updated_at: null,
          base_revision: null,
          fields: {},
        },
        remote: null,
        base: null,
        differing_fields: [],
        auto_combinable_fields: [],
        both_changed_fields: [],
      })
    ).toBe(true);
  });
});
