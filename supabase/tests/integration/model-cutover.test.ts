import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createIsolatedUser, newId } from "./helpers";

// The data conversion in 20261007131137_model_cutover.sql, run against rows
// shaped like the ones found in production before the migration window.
// Rows are written and read as the database owner (the way the migration runs),
// because the API roles have no direct table access to these tables.

type Row = Record<string, unknown>;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Run SQL as the database owner and return the rows of the last statement. */
function sql(statement: string): Row[] {
  try {
    const out = execFileSync(
      "pnpm",
      ["exec", "supabase", "db", "query", "--local", "--output-format", "json", statement],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const start = out.indexOf("{");
    // Statements that return nothing (INSERT, UPDATE) print no JSON.
    if (start < 0) return [];
    return (JSON.parse(out.slice(start)) as { rows?: Row[] }).rows ?? [];
  } catch (error) {
    // The CLI error repeats the whole statement; keep only its message.
    const text = String((error as { stdout?: string }).stdout ?? error);
    const message = /"message":"([^"]*)"/.exec(text)?.[1] ?? text.slice(-400);
    throw new Error(`SQL failed: ${message}`);
  }
}

/** Compare timestamps as instants, whatever text form the CLI prints. */
const at = (value: unknown): number => new Date(String(value)).getTime();

const lit = (value: unknown): string =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number" || typeof value === "boolean"
      ? String(value).toUpperCase()
      : typeof value === "object"
        ? `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
        : `'${String(value).replaceAll("'", "''")}'`;

function insert(table: string, rows: Row[]): string {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const values = rows
    .map((r) => `(${cols.map((c) => lit(r[c])).join(", ")})`)
    .join(",\n");
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${values};`;
}

const T0 = "2026-03-01T12:00:00.000Z";

describe("A6 model cutover conversion", () => {
  let userId: string;

  // Ids for the scenario.
  const groupWork = newId();
  const groupWorkout = newId();
  const groupEmpty = newId();
  const groupArchived = newId();
  const arch = newId(); // archived activity with an archive event
  const archNoEvent = newId(); // archived, but no event (falls back to completed_at)
  const gym = newId(); // row never deleted, final "deleted" event
  const avoid = newId(); // routine "never"
  const hiddenData = newId(); // hidden, has a live session
  const hiddenEmpty = newId(); // hidden, holds nothing
  const hiddenClash = newId(); // hidden in a group that already has the group's name
  const clashSibling = newId();
  const counter = newId(); // target 2, reached, zero-length session donates
  const counter2 = newId(); // reached on the SAME day as `counter`
  const notReached = newId(); // target 3, only 1, zero-length is ignored
  const memoLive = newId();
  const memoDisabled = newId();
  const memoDeleted = newId();
  const entryDay = newId();
  const stale = newId(); // session open for days
  const fresh = newId(); // session open for minutes
  let first: Record<string, number>;
  let second: Record<string, number>;

  beforeAll(async () => {
    const user = await createIsolatedUser();
    userId = user.userId;
    const base = { user_id: userId, created_at: T0, updated_at: T0 };

    const seed: string[] = [];
    seed.push(
      insert("activity_groups", [
        { ...base, id: groupWork, name: "Work" },
        { ...base, id: groupWorkout, name: "Workout" },
        { ...base, id: groupEmpty, name: "Empty" },
        { ...base, id: groupArchived, name: "Old", is_archived: true },
      ])
    );
    seed.push(
      insert("activities", [
        { ...base, id: arch, group_id: groupWork, name: "Read", routine: "daily", is_archived: true, completed_at: "2026-05-01T00:00:00Z" },
        { ...base, id: archNoEvent, group_id: groupWork, name: "Journal", routine: "daily", is_archived: true, completed_at: "2026-04-10T00:00:00Z" },
        { ...base, id: gym, group_id: groupWorkout, name: "Gym", routine: "anytime" },
        { ...base, id: avoid, group_id: groupWork, name: "No sugar", routine: "never" },
        { ...base, id: hiddenData, group_id: groupWork, name: null, routine: null },
        { ...base, id: hiddenEmpty, group_id: groupEmpty, name: null, routine: null },
        { ...base, id: hiddenClash, group_id: groupWorkout, name: null, routine: null },
        { ...base, id: clashSibling, group_id: groupWorkout, name: "Workout", routine: "daily" },
        { ...base, id: counter, group_id: groupWork, name: "Water", routine: "daily", completion_target: 2 },
        { ...base, id: counter2, group_id: groupWork, name: "Tidy bed", routine: "daily", completion_target: 1 },
        { ...base, id: notReached, group_id: groupWork, name: "Pushups", routine: "daily", completion_target: 3 },
        { ...base, id: stale, group_id: groupWork, name: "Harumi", routine: "anytime" },
      ])
    );
    // Gym ends on "deleted"; `arch` has an archive date.
    seed.push(
      insert("activity_status_events", [
        { ...base, id: newId(), entity_id: arch, status_type: "completed", next_value: true, effective_at: "2026-05-02T04:00:00Z", created_at: "2026-05-01T10:00:00Z" },
        { ...base, id: newId(), entity_id: gym, status_type: "completed", next_value: true, effective_at: "2026-06-04T04:00:00Z", created_at: "2026-06-04T00:19:49Z" },
        { ...base, id: newId(), entity_id: gym, status_type: "completed", next_value: false, effective_at: "2026-06-04T04:00:00Z", created_at: "2026-06-04T19:16:06Z" },
        { ...base, id: newId(), entity_id: gym, status_type: "deleted", next_value: true, effective_at: "2026-06-04T04:00:00Z", created_at: "2026-06-04T19:16:11Z" },
      ])
    );
    seed.push(
      insert("group_status_events", [
        { ...base, id: newId(), entity_id: groupArchived, status_type: "archived", next_value: true, effective_at: "2026-04-01T04:00:00Z" },
      ])
    );
    seed.push(
      insert("recurring_memos", [
        { ...base, id: memoLive, title: "Creatine", routine: "daily", is_pinned: true, is_enabled: true },
        { ...base, id: memoDisabled, title: "Vitamin D", routine: "weekly:1,3,5", is_pinned: false, is_enabled: false },
        { ...base, id: memoDeleted, title: "Avodart", routine: "custom:2:days", is_pinned: true, is_enabled: true, deleted_at: "2026-06-01T00:00:00Z" },
      ])
    );
    // A day where `counter` reached its target and `notReached` did not.
    seed.push(
      insert("daily_entries", [
        {
          ...base, id: entryDay, date: "2026-06-26",
          task_counts: { [counter]: 2, [counter2]: 1, [notReached]: 1 },
          completion_times: {}, completion_notes: {},
        },
      ])
    );
    const period = (id: string, activity: string, start: string, end: string | null, extra: Row = {}) => ({
      ...base, id, activity_id: activity, daily_entry_id: entryDay, start_time: start, end_time: end, ...extra,
    });
    seed.push(
      insert("activity_periods", [
        // zero-length: counts reached -> donates time and note
        period(newId(), counter, "2026-06-26T15:47:00Z", "2026-06-26T15:47:00Z", { note: "after lunch" }),
        // a second activity completing on the same day also donates
        period(newId(), counter2, "2026-06-26T08:15:00Z", "2026-06-26T08:15:00Z", { note: "made it" }),
        // zero-length: counts NOT reached -> ignored
        period(newId(), notReached, "2026-06-26T09:00:00Z", "2026-06-26T09:00:00Z", { note: "ignored" }),
        // a real session on the hidden activity gives it live data
        period(newId(), hiddenData, "2026-06-26T10:00:00Z", "2026-06-26T10:30:00Z"),
        // a deleted session does not count as live data
        period(newId(), hiddenEmpty, "2026-06-26T11:00:00Z", "2026-06-26T11:30:00Z", { deleted_at: "2026-06-27T00:00:00Z" }),
        // open for days: closed one hour after it started
        period(stale, stale, "2026-09-01T15:05:17Z", null),
        // open for minutes: left running
        period(fresh, avoid, new Date(Date.now() - 5 * 60_000).toISOString(), null),
      ])
    );
    for (const statement of seed) sql(statement);

    first = sql("SELECT cutover_a6_convert() AS r;")[0].r as Record<string, number>;
    second = sql("SELECT cutover_a6_convert() AS r;")[0].r as Record<string, number>;
  });

  const activity = async (id: string) =>
    sql(`SELECT * FROM activities WHERE id = '${id}'`)[0];
  const group = async (id: string) =>
    sql(`SELECT * FROM activity_groups WHERE id = '${id}'`)[0];

  describe("lifecycle becomes timestamps", () => {
    it("dates an archived activity from its archive event", async () => {
      expect(at((await activity(arch)).archived_at)).toBe(at("2026-05-02T04:00:00Z"));
    });

    it("falls back to completed_at when there is no event", async () => {
      expect(at((await activity(archNoEvent)).archived_at)).toBe(at("2026-04-10T00:00:00Z"));
    });

    it("dates an archived group from its event", async () => {
      expect(at((await group(groupArchived)).archived_at)).toBe(at("2026-04-01T04:00:00Z"));
    });

    it("leaves live items unarchived", async () => {
      expect((await activity(avoid)).archived_at).toBeNull();
      expect((await group(groupWork)).archived_at).toBeNull();
    });

    it("applies a final delete event as of the migration, not the event date", async () => {
      const row = await activity(gym);
      expect(row.deleted_at).not.toBeNull();
      // Deleted "now", so the days it was used on (after June) still show it.
      expect(new Date(row.deleted_at as string).getTime()).toBeGreaterThan(
        new Date("2026-09-01").getTime()
      );
    });
  });

  describe("hidden group activities", () => {
    it("names one with live data after its group and keeps it", async () => {
      const row = await activity(hiddenData);
      expect(row).toMatchObject({ name: "Work", routine: "anytime", tracks_time: true });
      expect(row.deleted_at).toBeNull();
    });

    it("names an empty one and then deletes it", async () => {
      const row = await activity(hiddenEmpty);
      expect(row.name).toBe("Empty");
      expect(row.deleted_at).not.toBeNull();
    });

    it("uses '<group> · general' when the group's name is taken", async () => {
      expect((await activity(hiddenClash)).name).toBe("Workout · general");
    });

    it("leaves no unnamed activity behind", async () => {
      const rows = sql(
        `SELECT id FROM activities WHERE user_id = '${userId}' AND name IS NULL`
      );
      expect(rows).toHaveLength(0);
    });

    it("does not count a deleted session as live data", async () => {
      expect(first.hidden_activities_deleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe("avoid habits", () => {
    it("never track time", async () => {
      expect((await activity(avoid)).tracks_time).toBe(false);
    });

    it("leaves other activities timed", async () => {
      expect((await activity(counter)).tracks_time).toBe(true);
    });
  });

  describe("recurring memos become Routines", () => {
    const routinesGroup = async () =>
      sql(
        `SELECT * FROM activity_groups WHERE user_id = '${userId}' AND name = 'Routines'`
      );
    const routines = async () => {
      const [g] = await routinesGroup();
      return sql(`SELECT * FROM activities WHERE group_id = '${g.id}'`);
    };

    it("creates one Routines group", async () => {
      expect(await routinesGroup()).toHaveLength(1);
    });

    it("turns each memo into a check-only activity in that group", async () => {
      const rows = await routines();
      expect(rows.map((r) => r.name).sort()).toEqual(["Avodart", "Creatine", "Vitamin D"]);
      for (const row of rows) {
        expect(row).toMatchObject({ tracks_time: false, completion_target: 1 });
      }
    });

    it("carries over the routine and the pin", async () => {
      const rows = await routines();
      const by = (name: string) => rows.find((r) => r.name === name)!;
      expect(by("Creatine")).toMatchObject({ routine: "daily", is_pinned: true });
      expect(by("Vitamin D")).toMatchObject({ routine: "weekly:1,3,5", is_pinned: false });
    });

    it("archives a disabled memo and keeps a deleted one deleted", async () => {
      const rows = await routines();
      const by = (name: string) => rows.find((r) => r.name === name)!;
      expect(by("Vitamin D").archived_at).not.toBeNull();
      expect(by("Creatine").archived_at).toBeNull();
      expect(by("Avodart").deleted_at).not.toBeNull();
    });

    it("keeps the memo tables as they were", async () => {
      const memos = sql(
        `SELECT id FROM recurring_memos WHERE user_id = '${userId}'`
      );
      expect(memos).toHaveLength(3);
    });
  });

  describe("zero-length sessions", () => {
    const day = async () =>
      sql(`SELECT * FROM daily_entries WHERE id = '${entryDay}'`)[0];

    it("donate their time to a day whose count reached the target", async () => {
      expect(((await day()).completion_times as Row)[counter]).toBe("2026-06-26T15:47:00.000Z");
    });

    it("donate to every activity completed on the same day, not just one", async () => {
      const times = (await day()).completion_times as Row;
      expect(times[counter]).toBe("2026-06-26T15:47:00.000Z");
      expect(times[counter2]).toBe("2026-06-26T08:15:00.000Z");
      const notes = (await day()).completion_notes as Row;
      expect(notes[counter2]).toBe("made it");
    });

    it("donate their note too", async () => {
      expect(((await day()).completion_notes as Row)[counter]).toBe("after lunch");
    });

    it("are ignored when the count did not reach the target", async () => {
      const d = await day();
      expect((d.completion_times as Row)[notReached]).toBeUndefined();
      expect((d.completion_notes as Row)[notReached]).toBeUndefined();
    });

    it("are never deleted", async () => {
      const rows = sql(
        `SELECT id FROM activity_periods WHERE daily_entry_id = '${entryDay}' AND deleted_at IS NULL`
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("forgotten running sessions", () => {
    it("are closed an hour after they started", async () => {
      const row = sql(`SELECT * FROM activity_periods WHERE id = '${stale}'`)[0];
      expect(at(row.end_time)).toBe(at("2026-09-01T16:05:17Z"));
    });

    it("leave a session that has only just started alone", async () => {
      const row = sql(`SELECT end_time FROM activity_periods WHERE id = '${fresh}'`)[0];
      expect(row.end_time).toBeNull();
    });
  });

  describe("running the conversion twice", () => {
    it("changes nothing the second time", () => {
      for (const key of [
        "archived_activities",
        "archived_groups",
        "deleted_activities_from_events",
        "deleted_groups_from_events",
        "hidden_activities_named",
        "routines_groups_created",
        "memos_converted",
        "completion_times_filled",
        "completion_notes_filled",
        "stale_sessions_closed",
      ]) {
        expect(second[key], key).toBe(0);
      }
    });

    it("filled both times and both notes on the first run", () => {
      // The summary covers the whole database, so other runs' leftovers count
      // too; what each user's day holds is asserted above.
      expect(first.completion_times_filled).toBeGreaterThanOrEqual(2);
      expect(first.completion_notes_filled).toBeGreaterThanOrEqual(2);
    });

    it("did something the first time", () => {
      expect(first.memos_converted).toBeGreaterThanOrEqual(3);
      expect(first.hidden_activities_named).toBeGreaterThanOrEqual(3);
      expect(first.stale_sessions_closed).toBeGreaterThanOrEqual(1);
    });
  });
});
