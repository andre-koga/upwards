import Dexie, { type Table } from "dexie";
import { v4 as uuidv4 } from "uuid";
import { toDateString } from "@/lib/date-utils";
import type {
  ActivityGroup,
  Activity,
  DailyEntry,
  ActivityPeriod,
  JournalEntry,
  OneTimeTask,
  ActivityStreak,
} from "./types";

export class UpwardsDB extends Dexie {
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
  }
}

export const db = new UpwardsDB();

// Helper: current ISO timestamp
export const now = () => new Date().toISOString();

// Helper: new UUID
export const newId = () => uuidv4();

// Helper: today as YYYY-MM-DD (local time, consistent with toDateStr)
export const todayStr = () => toDateString(new Date());

// Helper: date to YYYY-MM-DD string (local time, not UTC)
export const toDateStr = toDateString;

// Re-export types for convenience
export type {
  ActivityGroup,
  Activity,
  DailyEntry,
  ActivityPeriod,
  JournalEntry,
  OneTimeTask,
  ActivityStreak,
} from "./types";
