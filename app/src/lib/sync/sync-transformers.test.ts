import { describe, expect, it, vi } from "vitest";
import {
  dedupeRowsForUpsert,
  isValidUuid,
  normalizeSyncRow,
  parseTimestamp,
  toRemoteRow,
} from "./sync-transformers";
import { stripUnknownColumns } from "./sanitizers";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";

describe("sync transformers", () => {
  it("validates UUIDs", () => {
    expect(isValidUuid(VALID_UUID)).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid(null)).toBe(false);
  });

  it("normalizes invalid foreign keys to null and clears group emoji", () => {
    expect(
      normalizeSyncRow("activity_groups", {
        id: VALID_UUID,
        emoji: "🔥",
      })
    ).toEqual({ id: VALID_UUID, emoji: null });

    expect(
      normalizeSyncRow("activities", {
        id: VALID_UUID,
        group_id: "bad",
      }).group_id
    ).toBeNull();

    expect(
      normalizeSyncRow("daily_entries", {
        id: VALID_UUID,
        current_activity_id: "bad",
      }).current_activity_id
    ).toBeNull();
  });

  it("builds remote rows and rejects invalid ids", () => {
    expect(
      toRemoteRow(
        "activities",
        {
          id: VALID_UUID,
          group_id: VALID_UUID_B,
          synced_at: "2026-01-01T00:00:00.000Z",
        },
        "user-1"
      )
    ).toEqual({
      id: VALID_UUID,
      group_id: VALID_UUID_B,
      user_id: "user-1",
    });
    expect(
      toRemoteRow("activities", { id: "bad", synced_at: null }, "user-1")
    ).toBeNull();
  });

  it("parses timestamps and dedupes upserts by conflict key", () => {
    expect(parseTimestamp("2026-06-15T12:00:00.000Z")).toBeGreaterThan(0);
    expect(parseTimestamp("nope")).toBe(0);

    const rows = dedupeRowsForUpsert("daily_entries", [
      {
        id: "a",
        user_id: "u1",
        date: "2026-06-15",
        updated_at: "2026-06-15T10:00:00.000Z",
        value: 1,
      },
      {
        id: "b",
        user_id: "u1",
        date: "2026-06-15",
        updated_at: "2026-06-15T12:00:00.000Z",
        value: 2,
      },
      {
        id: "c",
        user_id: "u1",
        date: "2026-06-16",
        updated_at: "2026-06-16T09:00:00.000Z",
        value: 3,
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.date === "2026-06-15")?.value).toBe(2);
  });
});

describe("stripUnknownColumns", () => {
  it("drops legacy columns before upsert", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stripped = stripUnknownColumns("activities", [
      {
        id: VALID_UUID,
        user_id: "u1",
        name: "Read",
        legacy_pattern: "daily",
        pattern: "weekly:1",
      },
    ]);
    expect(stripped[0]).toEqual({
      id: VALID_UUID,
      user_id: "u1",
      name: "Read",
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
