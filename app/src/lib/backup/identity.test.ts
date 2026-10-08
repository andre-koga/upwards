import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getCachedUserId: () => null }));
vi.mock("@/lib/sync/device-id", () => ({ getOrCreateDeviceId: () => "dev" }));

import { naturalDailyEntryId, naturalJournalId } from "@/lib/sync/natural-ids";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  emptyBackupTables,
  type BackupDocument,
} from "./format";
import { backupOperationId, remapBackupIdentity } from "./identity";

const SOURCE = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";

function doc(source: string | null): BackupDocument {
  const tables = emptyBackupTables();
  tables.activityGroups.push({
    id: "g1",
    name: "Health",
    color: null,
    order_index: 0,
    archived_at: null,
    created_at: "t",
    updated_at: "t",
    synced_at: null,
    deleted_at: null,
  });
  tables.activities.push({
    id: "a1",
    group_id: "g1",
    name: "Run",
    routine: "daily",
    completion_target: 1,
    archived_at: "2026-08-01T00:00:00.000Z",
    tracks_time: true,
    is_pinned: false,
    order_index: 0,
    created_at: "t",
    updated_at: "t",
    synced_at: null,
    deleted_at: null,
  });
  tables.dailyEntries.push({
    id: "legacy-day",
    date: "2026-09-01",
    task_counts: { a1: 2 },
    paused_task_ids: ["a1"],
    is_break_day: false,
    completion_notes: { a1: "note" },
    completion_times: {},
    created_at: "t",
    updated_at: "t",
    synced_at: null,
    deleted_at: null,
  });
  tables.activityPeriods.push({
    id: "p1",
    activity_id: "a1",
    start_time: "2026-09-01T08:00:00.000Z",
    end_time: "2026-09-01T09:00:00.000Z",
    note: null,
    created_at: "t",
    updated_at: "t",
    synced_at: null,
    deleted_at: null,
  });
  tables.journalEntries.push({
    id: "legacy-journal",
    entry_date: "2026-09-01",
    title: null,
    text_content: "hello",
    day_emoji: null,
    is_bookmarked: false,
    video_path: `${SOURCE}/2026-09-01/clip.mp4`,
    video_thumbnail: null,
    photo_paths: [`${SOURCE}/2026-09-01/a.jpg`],
    location: null,
    created_at: "t",
    updated_at: "t",
    synced_at: null,
    deleted_at: null,
  });
  return {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    exported_at: "t",
    source_user_key: source,
    settings: null,
    tables,
    media: [
      {
        bucket: "journal-photos",
        path: `${SOURCE}/2026-09-01/a.jpg`,
        sha256: "x",
        size: 1,
        content_type: null,
      },
    ],
  };
}

describe("remapBackupIdentity", () => {
  it("keeps ids for the same account but uses natural day and journal ids", () => {
    const out = remapBackupIdentity(doc(TARGET), TARGET).tables;
    expect(out.activities[0].id).toBe("a1");
    expect(out.dailyEntries[0].id).toBe(
      naturalDailyEntryId(TARGET, "2026-09-01")
    );
    expect(out.journalEntries[0].id).toBe(
      naturalJournalId(TARGET, "2026-09-01")
    );
  });

  it("drops the columns the server no longer has from older files", () => {
    const file = doc(TARGET);
    Object.assign(file.tables.activityGroups[0], {
      emoji: "🌱",
      is_archived: true,
    });
    Object.assign(file.tables.activities[0], {
      is_archived: true,
      completed_at: "2026-08-01T00:00:00.000Z",
    });
    Object.assign(file.tables.dailyEntries[0], { current_activity_id: "a1" });
    // Sessions carry no day link, whatever the file said.
    Object.assign(file.tables.activityPeriods[0], { daily_entry_id: "d1" });
    Object.assign(file.tables.journalEntries[0], {
      is_journal_complete: true,
      journal_entry_number: 3,
      journal_completion_streak: 2,
      journal_completed_at: "2026-09-01T20:00:00.000Z",
    });
    const out = remapBackupIdentity(file, TARGET).tables;
    for (const [rows, columns] of [
      [out.activityGroups, ["emoji", "is_archived"]],
      [out.activities, ["is_archived", "completed_at"]],
      [out.dailyEntries, ["current_activity_id"]],
      [out.activityPeriods, ["daily_entry_id"]],
      [
        out.journalEntries,
        [
          "is_journal_complete",
          "journal_entry_number",
          "journal_completion_streak",
          "journal_completed_at",
        ],
      ],
    ] as const) {
      for (const column of columns) expect(rows[0]).not.toHaveProperty(column);
    }
    // What the file meant still survives: archive state is archived_at.
    expect(out.activities[0].archived_at).toBe("2026-08-01T00:00:00.000Z");
  });

  it("re-keys another account's rows and every reference consistently", () => {
    const remapped = remapBackupIdentity(doc(SOURCE), TARGET);
    const out = remapped.tables;
    const activityId = out.activities[0].id;
    expect(activityId).not.toBe("a1");
    expect(out.activities[0].group_id).toBe(out.activityGroups[0].id);
    expect(Object.keys(out.dailyEntries[0].task_counts ?? {})).toEqual([
      activityId,
    ]);
    expect(out.dailyEntries[0].paused_task_ids).toEqual([activityId]);
    expect(Object.keys(out.dailyEntries[0].completion_notes ?? {})).toEqual([
      activityId,
    ]);
    expect(out.activityPeriods[0].activity_id).toBe(activityId);
    expect(out.activities[0].archived_at).toBe("2026-08-01T00:00:00.000Z");
    expect(out.journalEntries[0].photo_paths).toEqual([
      `${TARGET}/2026-09-01/a.jpg`,
    ]);
    expect(out.journalEntries[0].video_path).toBe(
      `${TARGET}/2026-09-01/clip.mp4`
    );
    expect(remapped.media[0].path).toBe(`${TARGET}/2026-09-01/a.jpg`);
    expect(remapped.source_user_key).toBe(TARGET);
  });

  it("re-keys deterministically, so re-importing hits the same rows", () => {
    expect(remapBackupIdentity(doc(SOURCE), TARGET)).toEqual(
      remapBackupIdentity(doc(SOURCE), TARGET)
    );
  });
});

describe("backupOperationId", () => {
  it("is stable for the same change from the same synced state", () => {
    const parts = ["count", "2026-09-01", "a1", 1, 3];
    expect(backupOperationId(TARGET, 40, parts)).toBe(
      backupOperationId(TARGET, 40, parts)
    );
  });

  it("changes once the device has synced further", () => {
    const parts = ["count", "2026-09-01", "a1", 1, 3];
    expect(backupOperationId(TARGET, 40, parts)).not.toBe(
      backupOperationId(TARGET, 41, parts)
    );
  });
});
