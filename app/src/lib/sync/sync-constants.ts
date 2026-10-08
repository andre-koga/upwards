import { db } from "@/lib/db";
import type { SyncTable } from "./sync-transformers";

export const EPOCH = "1970-01-01T00:00:00.000Z";
/**
 * Sent to every sync RPC; the server rejects builds below
 * `app_config.min_client_protocol` with `client_outdated`. Bump it whenever
 * operation shapes or table semantics change, and raise the server minimum in
 * the same migration window (docs/architecture/product-scope.md §4.1).
 */
export const CLIENT_PROTOCOL = 3;
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
  "journal_entry_revisions",
  "memories",
  "one_time_tasks",
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
  journal_entry_revisions: "journalEntryRevisions",
  memories: "memories",
  one_time_tasks: "oneTimeTasks",
};
