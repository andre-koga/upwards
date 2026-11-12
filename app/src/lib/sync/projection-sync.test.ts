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

  it("maps the Big Five tables both ways", () => {
    expect(syncTableToEntityType("personality_sittings")).toBe(
      "personality_sitting"
    );
    expect(entityTypeToSyncTable("personality_sitting")).toBe(
      "personality_sittings"
    );
    expect(syncTableToEntityType("journal_readings")).toBe("journal_reading");
    expect(entityTypeToSyncTable("journal_reading")).toBe("journal_readings");
  });

  it("does not strip current activity fields from projection payloads", () => {
    const row = {
      id: "a1",
      name: "Run",
      completed_at: "2026-08-01T12:00:00.000Z",
      is_archived: true,
      deleted_at: null,
    };
    expect(stripOpOwnedFields("activities", row)).toEqual(row);
  });
});
