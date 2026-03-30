import { db } from "@/lib/db";
import type { SyncTable } from "./sync-transformers";

export const EPOCH = "1970-01-01T00:00:00.000Z";
export const DEBOUNCE_SYNC_MS = 5_000;
export const DEFAULT_PERIODIC_SYNC_MS = 60_000;
/** Buffer for incremental pull to avoid missing rows due to device clock skew. */
export const PULL_BUFFER_MS = 5 * 60 * 1000;
/** Avoid infinite resync loops if something keeps marking rows dirty unexpectedly. */
export const MAX_CHAINED_SYNCS = 25;

export const SYNC_TABLES: SyncTable[] = [
  "activity_groups",
  "activities",
  "daily_entries",
  "activity_periods",
  "journal_entries",
  "one_time_tasks",
  "activity_streaks",
];

export const TABLE_MAP: Record<SyncTable, keyof typeof db> = {
  activity_groups: "activityGroups",
  activities: "activities",
  daily_entries: "dailyEntries",
  activity_periods: "activityPeriods",
  journal_entries: "journalEntries",
  one_time_tasks: "oneTimeTasks",
  activity_streaks: "activityStreaks",
};

/**
 * Reference tables: always pull all so child records find their refs.
 * activity_periods: full pull so timeline never misses the latest period (clock skew).
 */
export const FULL_PULL_TABLES: SyncTable[] = [
  "activity_groups",
  "activities",
  "daily_entries",
  "activity_periods",
];
