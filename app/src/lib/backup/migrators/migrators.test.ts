import { describe, expect, it } from "vitest";
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from "../format";
import { BackupFormatError, migrateBackupDocument } from "./index";

const USER = "33333333-3333-4333-8333-333333333333";

function v4File() {
  return {
    exportedAt: "2026-08-01T00:00:00.000Z",
    version: 4,
    activityGroups: [],
    activities: [
      {
        id: "a1",
        group_id: "g1",
        name: "Run",
        completed_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
      },
    ],
    dailyEntries: [
      {
        id: "d1",
        date: "2026-07-01",
        task_counts: { a1: 1 },
        paused_task_ids: [],
      },
    ],
    activityPeriods: [
      {
        id: "untimed",
        daily_entry_id: "d1",
        activity_id: "a1",
        start_time: "2026-07-01T10:00:00.000Z",
        end_time: "2026-07-01T10:00:00.000Z",
        note: "  felt good  ",
      },
      {
        id: "timed",
        daily_entry_id: "d1",
        activity_id: "a1",
        start_time: "2026-07-01T11:00:00.000Z",
        end_time: "2026-07-01T12:00:00.000Z",
        note: "   ",
      },
    ],
    journalEntries: [
      {
        id: "j1",
        entry_date: "2026-07-01",
        youtube_url: `https://x.supabase.co/storage/v1/object/public/journal-videos/${USER}/2026-07-01/c.mp4`,
        location: "Lisbon",
        photo_paths: [`${USER}/2026-07-01/a.jpg`],
      },
    ],
    oneTimeTasks: [{ id: "t1", title: "Call" }],
    recurringMemos: [],
    activityStatusEvents: [],
    groupStatusEvents: [],
  };
}

describe("migrateBackupDocument", () => {
  it("upgrades a format 4 file through the scope migrations", () => {
    const doc = migrateBackupDocument(v4File());
    expect(doc.format).toBe(BACKUP_FORMAT);
    expect(doc.format_version).toBe(BACKUP_FORMAT_VERSION);
    expect(doc.exported_at).toBe("2026-08-01T00:00:00.000Z");
    expect(doc.source_user_key).toBe(USER);
    expect(doc.tables.memories).toEqual([]);

    const activity = doc.tables.activities[0];
    expect(activity.is_archived).toBe(true);
    expect(activity.completed_at).toBe("2026-07-01T00:00:00.000Z");

    expect(doc.tables.activityPeriods.map((p) => p.id)).toEqual(["timed"]);
    expect(doc.tables.activityPeriods[0].note).toBeNull();
    expect(doc.tables.dailyEntries[0].completion_times).toEqual({
      a1: "2026-07-01T10:00:00.000Z",
    });
    expect(doc.tables.dailyEntries[0].completion_notes).toEqual({
      a1: "felt good",
    });

    const entry = doc.tables.journalEntries[0];
    expect(entry.video_path).toBe(`${USER}/2026-07-01/c.mp4`);
    expect(entry.location).toEqual({
      locations: [expect.objectContaining({ displayName: "Lisbon" })],
    });
    expect("youtube_url" in entry).toBe(false);
    expect(doc.tables.oneTimeTasks[0].recurring_memo_id).toBeNull();
  });

  it("accepts the current format and fills tables it lacks", () => {
    const doc = migrateBackupDocument({
      format: BACKUP_FORMAT,
      format_version: BACKUP_FORMAT_VERSION,
      exported_at: "t",
      source_user_key: USER,
      settings: { locale: "pt" },
      tables: { activities: [] },
      media: [],
    });
    expect(doc.tables.journalEntries).toEqual([]);
    expect(doc.settings).toEqual({ locale: "pt" });
  });

  it("rejects files it cannot read", () => {
    const code = (input: unknown) => {
      try {
        migrateBackupDocument(input);
        return null;
      } catch (err) {
        return err instanceof BackupFormatError ? err.code : "other";
      }
    };
    expect(code({ hello: "world" })).toBe("unrecognized");
    expect(code(null)).toBe("unrecognized");
    expect(
      code({ format: BACKUP_FORMAT, format_version: BACKUP_FORMAT_VERSION + 1 })
    ).toBe("newer_version");
  });
});
