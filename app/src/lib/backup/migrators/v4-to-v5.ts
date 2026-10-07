import { normalizeSessionNote } from "@/lib/activity/session-note";
import {
  normalizeLegacyLocationRoute,
  normalizeLegacyVideoPath,
} from "@/lib/db/legacy-shapes";
import type {
  Activity,
  ActivityPeriod,
  DailyEntry,
  JournalEntry,
  Memory,
  OneTimeTask,
} from "@/lib/db/types";
import {
  BACKUP_FORMAT,
  BACKUP_TABLE_NAMES,
  emptyBackupTables,
} from "../format";
import type { BackupDocumentV5, BackupTablesV5 } from "./v5-to-v6";

type LegacyRow = Record<string, unknown>;

/** Closed period whose start and end are the same instant: how old builds stored a completion. */
function isUntimedPeriod(startTime: string, endTime: string | null): boolean {
  if (!endTime) return false;
  const startMs = new Date(startTime).getTime();
  return Number.isFinite(startMs) && startMs === new Date(endTime).getTime();
}

const STORAGE_OWNER_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

function rows(value: unknown): LegacyRow[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is LegacyRow =>
          !!row && typeof row === "object" && !Array.isArray(row)
      )
    : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeActivity(row: LegacyRow): Activity {
  const completedAt = str(row.completed_at);
  const archived = row.is_archived === true || Boolean(completedAt);
  return {
    ...(row as unknown as Activity),
    is_archived: archived,
    completed_at: archived
      ? (completedAt ?? str(row.updated_at) ?? str(row.created_at))
      : null,
  };
}

function normalizeJournal(row: LegacyRow): JournalEntry {
  const copy = { ...row };
  const videoPath =
    normalizeLegacyVideoPath(copy.video_path) ??
    normalizeLegacyVideoPath(copy.youtube_url);
  delete copy.youtube_url;
  return {
    ...(copy as unknown as JournalEntry),
    video_path: videoPath,
    video_thumbnail: str(copy.video_thumbnail),
    photo_paths: Array.isArray(copy.photo_paths)
      ? (copy.photo_paths as string[])
      : null,
    location: normalizeLegacyLocationRoute(
      copy.location
    ) as JournalEntry["location"],
  };
}

/**
 * Zero-length periods were how older builds stored untimed completions. They are
 * not facts any more: the count is the completion and its instant lives in
 * `completion_times`, so fold them into the day instead of importing them.
 */
function foldUntimedPeriods(
  periods: ActivityPeriod[],
  dailyEntries: DailyEntry[]
): ActivityPeriod[] {
  const byId = new Map(dailyEntries.map((entry) => [entry.id, entry]));
  const timed: ActivityPeriod[] = [];
  for (const period of periods) {
    if (!isUntimedPeriod(period.start_time, period.end_time)) {
      timed.push(period);
      continue;
    }
    const entry = period.daily_entry_id
      ? byId.get(period.daily_entry_id)
      : undefined;
    if (!entry || period.deleted_at) continue;
    const times = { ...(entry.completion_times ?? {}) };
    if (!times[period.activity_id]) {
      times[period.activity_id] = period.start_time;
      entry.completion_times = times;
    }
    if (period.note && !entry.completion_notes?.[period.activity_id]) {
      entry.completion_notes = {
        ...(entry.completion_notes ?? {}),
        [period.activity_id]: period.note,
      };
    }
  }
  return timed;
}

function inferSourceUserKey(tables: BackupTablesV5): string | null {
  const paths: string[] = [];
  for (const entry of tables.journalEntries) {
    paths.push(...(entry.photo_paths ?? []));
    if (entry.video_path) paths.push(entry.video_path);
  }
  for (const memory of tables.memories)
    paths.push(...(memory.photo_paths ?? []));
  for (const path of paths) {
    const match = STORAGE_OWNER_RE.exec(path);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/**
 * Format 4 and earlier: camelCase table arrays at the top level plus
 * `exportedAt`. Versions 1–3 share the layout with fewer tables.
 */
export function migrateV4ToV5(raw: LegacyRow): BackupDocumentV5 {
  const tables: BackupTablesV5 = {
    ...emptyBackupTables(),
    recurringMemos: [],
    activityStatusEvents: [],
    groupStatusEvents: [],
  };
  for (const name of [
    ...BACKUP_TABLE_NAMES,
    "recurringMemos",
    "activityStatusEvents",
    "groupStatusEvents",
  ] as const) {
    (tables[name] as unknown[]) = rows(raw[name]);
  }

  tables.activities = rows(raw.activities).map(normalizeActivity);
  tables.journalEntries = rows(raw.journalEntries).map(normalizeJournal);
  tables.memories = rows(raw.memories).map((row) => ({
    ...(row as unknown as Memory),
    photo_paths: Array.isArray(row.photo_paths)
      ? (row.photo_paths as string[])
      : null,
  }));
  tables.oneTimeTasks = rows(raw.oneTimeTasks).map((row) => ({
    ...(row as unknown as OneTimeTask),
    recurring_memo_id: str(row.recurring_memo_id),
  }));
  tables.dailyEntries = rows(raw.dailyEntries).map((row) => ({
    ...(row as unknown as DailyEntry),
    completion_notes:
      (row.completion_notes as DailyEntry["completion_notes"]) ?? {},
    completion_times:
      (row.completion_times as DailyEntry["completion_times"]) ?? {},
  }));
  tables.activityPeriods = foldUntimedPeriods(
    rows(raw.activityPeriods).map((row) => ({
      ...(row as unknown as ActivityPeriod),
      note: normalizeSessionNote(str(row.note)),
    })),
    tables.dailyEntries
  );

  return {
    format: BACKUP_FORMAT,
    format_version: 5,
    exported_at: str(raw.exportedAt) ?? new Date(0).toISOString(),
    source_user_key: inferSourceUserKey(tables),
    settings: null,
    tables,
    media: [],
  };
}
