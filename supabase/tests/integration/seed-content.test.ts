import { describe, expect, it } from "vitest";
import { sql } from "./sql";

// supabase/seeds/test-account.sql is what every local dev session and every
// screenshot starts from. A schema change that breaks it is caught by the
// reset failing; this catches the quieter failure, where the seed still runs but
// a block of it has gone missing (an edit once dropped the whole journal).

const ACCOUNT = "(SELECT id FROM auth.users WHERE email = 'test@test.com')";

const count = (table: string, where = "TRUE"): number => {
  const rows = sql(
    `SELECT count(*)::int AS n FROM ${table} WHERE user_id = ${ACCOUNT} AND ${where};`
  );
  return Number(rows[0]?.n);
};

describe("local test-account seed", () => {
  it("seeds a month and a half of days", () => {
    expect(count("daily_entries")).toBe(45);
  });

  it("seeds journal entries, each with its sync operation", () => {
    expect(count("journal_entries", "deleted_at IS NULL")).toBe(15);
    expect(count("sync_operations", "entity_type = 'journal_entry'")).toBe(15);
  });

  it("seeds activities, an archived activity, and an archived group", () => {
    expect(count("activities", "deleted_at IS NULL")).toBeGreaterThanOrEqual(10);
    expect(count("activities", "archived_at IS NOT NULL")).toBe(1);
    expect(count("activity_groups", "archived_at IS NOT NULL")).toBe(1);
  });

  it("seeds memos and timed sessions", () => {
    expect(count("one_time_tasks", "deleted_at IS NULL")).toBe(6);
    expect(count("activity_periods", "deleted_at IS NULL")).toBe(10);
  });
});
