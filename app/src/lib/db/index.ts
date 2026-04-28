import Dexie, { type Table } from "dexie";
import { v4 as uuidv4 } from "uuid";
import type {
  ActivityGroup,
  Activity,
  DailyEntry,
  ActivityPeriod,
  JournalEntry,
  OneTimeTask,
  ActivityStreak,
} from "./types";

const JOURNAL_VIDEO_PREFIX = "/storage/v1/object/public/journal-videos/";

function normalizeLegacyVideoPath(pathOrUrl: unknown): string | null {
  if (typeof pathOrUrl !== "string") return null;
  const value = pathOrUrl.trim();
  if (!value) return null;
  if (!value.includes("://")) return value;

  try {
    const parsed = new URL(value);
    if (!parsed.pathname.startsWith(JOURNAL_VIDEO_PREFIX)) {
      return null;
    }
    return decodeURIComponent(
      parsed.pathname.slice(JOURNAL_VIDEO_PREFIX.length)
    );
  } catch {
    return null;
  }
}

class UpwardsDB extends Dexie {
  activityGroups!: Table<ActivityGroup>;
  activities!: Table<Activity>;
  dailyEntries!: Table<DailyEntry>;
  activityPeriods!: Table<ActivityPeriod>;
  journalEntries!: Table<JournalEntry>;
  oneTimeTasks!: Table<OneTimeTask>;
  activityStreaks!: Table<ActivityStreak>;

  constructor() {
    super("okhabit");
    this.version(1).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries: "id, entry_date, is_bookmarked, deleted_at",
      oneTimeTasks: "id, date, is_completed, deleted_at, created_at",
    });

    this.version(2).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries: "id, entry_date, is_bookmarked, deleted_at",
      oneTimeTasks: "id, date, is_completed, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
    });

    this.version(3).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks: "id, date, is_completed, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
    });

    this.version(4).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      memoPeriods: "id, daily_entry_id, one_time_task_id, deleted_at",
    });

    this.version(5).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, is_break_day, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      memoPeriods: "id, daily_entry_id, one_time_task_id, deleted_at",
    });

    this.version(6)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        memoPeriods: "id, daily_entry_id, one_time_task_id, deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("journalEntries")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            const legacyPath = normalizeLegacyVideoPath(entry.youtube_url);
            const currentPath = normalizeLegacyVideoPath(entry.video_path);
            entry.video_path = currentPath ?? legacyPath;
            if ("youtube_url" in entry) {
              delete entry.youtube_url;
            }
          });
      });

    this.version(7)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
      })
      .upgrade(async (tx) => {
        await tx.table("memoPeriods").clear();
        await tx
          .table("dailyEntries")
          .toCollection()
          .modify((row) => {
            delete (row as Record<string, unknown>).current_memo_id;
          });
      });

    this.version(8)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("journalEntries")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            const location = entry.location;
            if (!location || typeof location !== "object") return;
            if (!("transitionTimes" in (location as Record<string, unknown>))) {
              return;
            }
            const normalizedLocation = {
              ...(location as Record<string, unknown>),
            };
            delete normalizedLocation.transitionTimes;
            entry.location = normalizedLocation;
          });
      });
  }
}

export const db = new UpwardsDB();

// Helper: current ISO timestamp
export const now = () => new Date().toISOString();

// Helper: new UUID
export const newId = () => uuidv4();
