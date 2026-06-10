import { db } from "@/lib/db";
import type { SyncTable } from "./sync-transformers";

export const EPOCH = "1970-01-01T00:00:00.000Z";
export const DEBOUNCE_SYNC_MS = 5_000;
export const DEFAULT_PERIODIC_SYNC_MS = 5 * 60_000;
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
  "activity_status_events",
  "group_status_events",
];

export const TABLE_MAP: Record<SyncTable, keyof typeof db> = {
  activity_groups: "activityGroups",
  activities: "activities",
  daily_entries: "dailyEntries",
  activity_periods: "activityPeriods",
  journal_entries: "journalEntries",
  one_time_tasks: "oneTimeTasks",
  activity_streaks: "activityStreaks",
  activity_status_events: "activityStatusEvents",
  group_status_events: "groupStatusEvents",
};
