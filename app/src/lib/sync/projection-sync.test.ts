import { describe, expect, it } from "vitest";
import {
  entityTypeToSyncTable,
  syncTableToEntityType,
} from "./projection-sync";
import { stripOpOwnedFields } from "./op-owned-fields";

describe("projection-sync mappings", () => {
  it("maps sync tables to entity types", () => {
    expect(syncTableToEntityType("journal_entries")).toBe("journal_entry");
    expect(entityTypeToSyncTable("journal_entry")).toBe("journal_entries");
    expect(syncTableToEntityType("activity_periods")).toBe("activity_period");
  });

  it("strips definition fields from activity projection payloads", () => {
    const stripped = stripOpOwnedFields("activities", {
      id: "a1",
      name: "Run",
      completed_at: "2026-08-01T12:00:00.000Z",
      deleted_at: null,
    });
    expect(stripped).toEqual({
      id: "a1",
      completed_at: "2026-08-01T12:00:00.000Z",
      deleted_at: null,
    });
  });
});
