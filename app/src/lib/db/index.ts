import Dexie, { type Table } from "dexie";
import { v4 as uuidv4 } from "uuid";
import type {
  ActivityGroup,
  Activity,
  DailyEntry,
  ActivityPeriod,
  JournalEntry,
  JournalEntryRevision,
  Memory,
  OneTimeTask,
  AppLog,
  SyncPendingOperation,
  SyncIssue,
  SyncDeviceRecord,
} from "./types";

export const LOCAL_DB_NAME = "okhabit";

/**
 * The one local schema (product-scope.md §2.10). There are no upgrade steps:
 * a database older than `MIN_UPGRADABLE_VERSION` never reaches Dexie, because
 * `prepareLocalDatabase()` moves its rows into a recovery bundle and deletes
 * it first. A v32 database already holds the cutover model (the server
 * converted it and the device re-bootstrapped), so Dexie upgrades it in place
 * by diffing the stores: the retired tables are dropped and nothing is
 * rewritten.
 */
export const BASELINE_VERSION = 33;
export const MIN_UPGRADABLE_VERSION = 32;

export const BASELINE_STORES = {
  activityGroups: "id, name, archived_at, deleted_at, created_at",
  activities: "id, group_id, archived_at, deleted_at, created_at",
  dailyEntries: "id, date, is_break_day, deleted_at",
  activityPeriods: "id, activity_id, start_time, end_time, deleted_at",
  journalEntries: "id, entry_date, is_bookmarked, deleted_at",
  journalEntryRevisions: "id, entry_date, created_at",
  memories: "id, deleted_at, created_at",
  oneTimeTasks:
    "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
  appLogs: "id, created_at, level",
  syncPendingOperations:
    "id, operation_id, status, account_id, device_id, created_at",
  syncIssues: "id, kind, status, account_id, created_at",
  syncDevices: "id, account_id, last_seen_at, retired_at",
} as const;

class UpwardsDB extends Dexie {
  activityGroups!: Table<ActivityGroup>;
  activities!: Table<Activity>;
  dailyEntries!: Table<DailyEntry>;
  activityPeriods!: Table<ActivityPeriod>;
  journalEntries!: Table<JournalEntry>;
  journalEntryRevisions!: Table<JournalEntryRevision>;
  memories!: Table<Memory>;
  oneTimeTasks!: Table<OneTimeTask>;
  appLogs!: Table<AppLog>;
  syncPendingOperations!: Table<SyncPendingOperation>;
  syncIssues!: Table<SyncIssue>;
  syncDevices!: Table<SyncDeviceRecord>;

  constructor() {
    super(LOCAL_DB_NAME);
    this.version(BASELINE_VERSION).stores(BASELINE_STORES);
  }
}

export const db = new UpwardsDB();

// Helper: current ISO timestamp
export const now = () => new Date().toISOString();

// Helper: new UUID
export const newId = () => uuidv4();
