import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  ActivityStatusEvent,
  DailyEntry,
  GroupStatusEvent,
  JournalEntry,
  JournalEntryRevision,
  Memory,
  OneTimeTask,
  RecurringMemo,
} from "@/lib/db/types";

export const BACKUP_FORMAT = "upwards-backup";
export const BACKUP_FORMAT_VERSION = 5;
export const CLIPS_FORMAT = "upwards-clips";
export const CLIPS_FORMAT_VERSION = 1;

export const BACKUP_JSON_NAME = "backup.json";
export const CLIPS_JSON_NAME = "clips.json";

export const PHOTO_BUCKET = "journal-photos";
export const VIDEO_BUCKET = "journal-videos";
export type MediaBucket = typeof PHOTO_BUCKET | typeof VIDEO_BUCKET;

export interface BackupTables {
  activityGroups: ActivityGroup[];
  activities: Activity[];
  dailyEntries: DailyEntry[];
  activityPeriods: ActivityPeriod[];
  journalEntries: JournalEntry[];
  journalEntryRevisions: JournalEntryRevision[];
  memories: Memory[];
  oneTimeTasks: OneTimeTask[];
  recurringMemos: RecurringMemo[];
  activityStatusEvents: ActivityStatusEvent[];
  groupStatusEvents: GroupStatusEvent[];
}

export type BackupTableName = keyof BackupTables;

/** Every user-owned Dexie table. `format.test.ts` fails when a table is unclassified. */
export const BACKUP_TABLE_NAMES = [
  "activityGroups",
  "activities",
  "dailyEntries",
  "activityPeriods",
  "journalEntries",
  "journalEntryRevisions",
  "memories",
  "oneTimeTasks",
  "recurringMemos",
  "activityStatusEvents",
  "groupStatusEvents",
] as const satisfies readonly BackupTableName[];

/**
 * Device-local infrastructure (logs, the pending-op queue, sync bookkeeping),
 * plus `memoPeriods`, which Dexie v7 emptied but never dropped.
 */
export const NON_BACKUP_TABLE_NAMES = [
  "appLogs",
  "syncPendingOperations",
  "syncIssues",
  "syncDevices",
  "memoPeriods",
] as const;

/**
 * Account settings. The AI connection is deliberately absent: it cannot be
 * saved without its API key, and the key never leaves the server.
 */
export interface BackupSettings {
  locale: string | null;
  /**
   * Optional so older v5 files still read. Automatic location is deliberately
   * not included: turning it on must be a fresh choice on each device, because
   * it triggers a browser permission request.
   */
  dailyClip?: boolean | null;
  holidayCalendars?: string[] | null;
  hemisphere?: "north" | "south" | null;
  /** Your own birth date; optional so older files still read. */
  birthday?: string | null;
}

/** A storage object carried in the archive under `media/<bucket>/<path>`. */
export interface BackupMediaFile {
  bucket: MediaBucket;
  path: string;
  sha256: string;
  size: number;
  content_type: string | null;
}

export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  format_version: typeof BACKUP_FORMAT_VERSION;
  exported_at: string;
  /** `syncUserKey` of the exporting account; null when unknown (legacy files). */
  source_user_key: string | null;
  settings: BackupSettings | null;
  tables: BackupTables;
  /** Files included in this archive. Empty for a data-only export. */
  media: BackupMediaFile[];
}

export interface ClipsManifest {
  format: typeof CLIPS_FORMAT;
  format_version: typeof CLIPS_FORMAT_VERSION;
  exported_at: string;
  source_user_key: string | null;
  year: number;
  clips: Array<{ entry_date: string; file: BackupMediaFile }>;
}

export function emptyBackupTables(): BackupTables {
  return {
    activityGroups: [],
    activities: [],
    dailyEntries: [],
    activityPeriods: [],
    journalEntries: [],
    journalEntryRevisions: [],
    memories: [],
    oneTimeTasks: [],
    recurringMemos: [],
    activityStatusEvents: [],
    groupStatusEvents: [],
  };
}

export function mediaArchivePath(file: {
  bucket: MediaBucket;
  path: string;
}): string {
  return `media/${file.bucket}/${file.path}`;
}

export function isClipsManifest(value: unknown): value is ClipsManifest {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { format?: unknown }).format === CLIPS_FORMAT
  );
}
