import { db } from "@/lib/db";
import type { SyncTable } from "./sync-transformers";

export const EPOCH = "1970-01-01T00:00:00.000Z";
export const DEBOUNCE_SYNC_MS = 5_000;
export const REMOTE_DEBOUNCE_SYNC_MS = 1_000;
export const DEFAULT_PERIODIC_SYNC_MS = 5 * 60_000;
/** Avoid infinite resync loops if something keeps marking rows dirty unexpectedly. */
export const MAX_CHAINED_SYNCS = 25;
/** Submit pending ops in chunks so a large cutover queue cannot stall the RPC. */
export const SUBMIT_SYNC_BATCH_SIZE = 50;

export const SYNC_TABLES: SyncTable[] = [
  "activity_groups",
  "activities",
  "daily_entries",
  "activity_periods",
  "journal_entries",
  "one_time_tasks",
  "recurring_memos",
  "activity_status_events",
  "group_status_events",
];

/**
 * When temporal ops RPCs are available, LWW still pushes these tables for
 * non-op columns, but daily-entry count/pause/break fields are stripped.
 * See `op-owned-fields.ts`.
 */

export const TABLE_MAP: Record<SyncTable, keyof typeof db> = {
  activity_groups: "activityGroups",
  activities: "activities",
  daily_entries: "dailyEntries",
  activity_periods: "activityPeriods",
  journal_entries: "journalEntries",
  one_time_tasks: "oneTimeTasks",
  recurring_memos: "recurringMemos",
  activity_status_events: "activityStatusEvents",
  group_status_events: "groupStatusEvents",
};
