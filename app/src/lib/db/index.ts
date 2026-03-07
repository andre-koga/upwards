import Dexie, { type Table } from "dexie";
import { v4 as uuidv4 } from "uuid";
import type {
    ActivityGroup,
    Activity,
    DailyEntry,
    ActivityPeriod,
    JournalEntry,
    OneTimeTask,
    TimeEntry,
} from "./types";

export class UpwardsDB extends Dexie {
    activityGroups!: Table<ActivityGroup>;
    activities!: Table<Activity>;
    dailyEntries!: Table<DailyEntry>;
    activityPeriods!: Table<ActivityPeriod>;
    journalEntries!: Table<JournalEntry>;
    oneTimeTasks!: Table<OneTimeTask>;
    timeEntries!: Table<TimeEntry>;

    constructor() {
        super("okhabit");
        this.version(1).stores({
            activityGroups: "id, name, is_archived, deleted_at, created_at",
            activities: "id, group_id, is_archived, deleted_at, created_at",
            dailyEntries: "id, date, deleted_at",
            activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
            journalEntries: "id, entry_date, is_bookmarked, deleted_at",
            oneTimeTasks: "id, date, is_completed, deleted_at, created_at",
            timeEntries: "id, activity_id, time_start, deleted_at",
        });
    }
}

export const db = new UpwardsDB();

// Helper: current ISO timestamp
export const now = () => new Date().toISOString();

// Helper: new UUID
export const newId = () => uuidv4();

// Helper: today as YYYY-MM-DD
export const todayStr = () => new Date().toISOString().split("T")[0];

// Helper: date to YYYY-MM-DD string (local time, not UTC)
export const toDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

// Re-export types for convenience
export type {
    ActivityGroup,
    Activity,
    DailyEntry,
    ActivityPeriod,
    JournalEntry,
    OneTimeTask,
    TimeEntry,
} from "./types";
