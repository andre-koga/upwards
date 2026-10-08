import { v5 as uuidv5 } from "uuid";
import {
  UPWARDS_SYNC_NAMESPACE,
  naturalDailyEntryId,
  naturalJournalId,
} from "@/lib/sync/natural-ids";
import { withoutDroppedColumns } from "@/lib/db/legacy-shapes";
import type { BackupDocument, BackupTables } from "./format";

/**
 * Operation id for one imported change.
 *
 * It is derived from the backup row, the change it makes, and the server
 * sequence this device has synced to. Two devices importing the same file from
 * the same synced state emit identical ids, so the server applies the change
 * once. A later import from a different state gets fresh ids, so a duplicate
 * check can never swallow a change the server has not seen.
 */
export function backupOperationId(
  targetUserKey: string,
  syncedSequence: number,
  parts: ReadonlyArray<string | number | boolean | null | undefined>
): string {
  return uuidv5(
    `backup-op:${targetUserKey}:${syncedSequence}:${parts.map((p) => String(p ?? "")).join(":")}`,
    UPWARDS_SYNC_NAMESPACE
  );
}

/** Identifies one backup's text for a journal entry, so re-importing it adds no second conflict. */
export function backupJournalFingerprint(
  entityId: string,
  text: string
): string {
  return uuidv5(`backup-journal:${entityId}:${text}`, UPWARDS_SYNC_NAMESPACE);
}

export function rewriteMediaOwner(
  path: string,
  sourceUserKey: string | null,
  targetUserKey: string
): string {
  if (!sourceUserKey || sourceUserKey === targetUserKey) return path;
  const prefix = `${sourceUserKey}/`;
  return path.startsWith(prefix)
    ? `${targetUserKey}/${path.slice(prefix.length)}`
    : path;
}

/**
 * Re-key a backup for the account it is being imported into.
 *
 * Journal entries and daily entries always take the target account's natural
 * ids, so a legacy file with per-device ids still lands on the right date.
 * Rows from a different account get new ids derived from their old ones (ids
 * are global keys on the server), and every reference is rewritten to match.
 * Storage paths move under the target account's folder.
 */
export function remapBackupIdentity(
  doc: BackupDocument,
  targetUserKey: string
): BackupDocument {
  const source = doc.source_user_key ?? targetUserKey;
  const foreign = source !== targetUserKey;
  const mapId = (kind: string, id: string): string =>
    foreign
      ? uuidv5(
          `backup-remap:${source}:${targetUserKey}:${kind}:${id}`,
          UPWARDS_SYNC_NAMESPACE
        )
      : id;
  const mapKeys = <T>(record: Record<string, T> | null): Record<string, T> =>
    Object.fromEntries(
      Object.entries(record ?? {}).map(([id, value]) => [
        mapId("activity", id),
        value,
      ])
    );
  const owner = (path: string) =>
    rewriteMediaOwner(path, source, targetUserKey);

  const t = doc.tables;
  const dailyIdByOldId = new Map<string, string>();
  for (const entry of t.dailyEntries) {
    dailyIdByOldId.set(
      entry.id,
      naturalDailyEntryId(targetUserKey, entry.date)
    );
  }

  const tables: BackupTables = {
    activityGroups: t.activityGroups.map((row) => ({
      ...withoutDroppedColumns("activity_groups", row),
      id: mapId("activity_group", row.id),
    })),
    activities: t.activities.map((row) => ({
      ...withoutDroppedColumns("activities", row),
      id: mapId("activity", row.id),
      group_id: mapId("activity_group", row.group_id),
    })),
    dailyEntries: t.dailyEntries.map((row) => ({
      ...withoutDroppedColumns("daily_entries", row),
      id: dailyIdByOldId.get(row.id)!,
      task_counts: mapKeys(row.task_counts),
      paused_task_ids: (row.paused_task_ids ?? []).map((id) =>
        mapId("activity", id)
      ),
      completion_notes: mapKeys(row.completion_notes),
      completion_times: mapKeys(row.completion_times),
    })),
    activityPeriods: t.activityPeriods.map((row) => ({
      // Sessions are found by time; they carry no daily-entry link.
      ...withoutDroppedColumns("activity_periods", row),
      id: mapId("activity_period", row.id),
      activity_id: mapId("activity", row.activity_id),
    })),
    journalEntries: t.journalEntries.map((row) => ({
      ...withoutDroppedColumns("journal_entries", row),
      id: naturalJournalId(targetUserKey, row.entry_date),
      photo_paths: row.photo_paths ? row.photo_paths.map(owner) : null,
      video_path: row.video_path ? owner(row.video_path) : null,
    })),
    journalEntryRevisions: t.journalEntryRevisions.map((row) => ({
      ...row,
      id: mapId("journal_entry_revision", row.id),
      photo_paths: row.photo_paths ? row.photo_paths.map(owner) : null,
      video_path: row.video_path ? owner(row.video_path) : null,
    })),
    memories: t.memories.map((row) => ({
      ...row,
      id: mapId("memory", row.id),
      photo_paths: row.photo_paths ? row.photo_paths.map(owner) : null,
    })),
    oneTimeTasks: t.oneTimeTasks.map((row) => ({
      ...withoutDroppedColumns("one_time_tasks", row),
      id: mapId("one_time_task", row.id),
    })),
  };

  return {
    ...doc,
    source_user_key: targetUserKey,
    tables,
    media: doc.media.map((file) => ({ ...file, path: owner(file.path) })),
  };
}
