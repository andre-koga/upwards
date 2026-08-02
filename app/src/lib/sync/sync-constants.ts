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
  "recurring_memos",
  "activity_streaks",
  "activity_status_events",
  "group_status_events",
];

/**
 * When temporal ops RPCs are available, LWW still pushes these tables for
 * non-op columns (e.g. completed_at), but op-owned fields are stripped.
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
  activity_streaks: "activityStreaks",
  activity_status_events: "activityStatusEvents",
  group_status_events: "groupStatusEvents",
  activity_definition_versions: "activityDefinitionVersions",
  group_definition_versions: "groupDefinitionVersions",
};
