import type { Table } from "dexie";
import { db, now } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  ActivityStatusEvent,
  DailyEntry,
  GroupStatusEvent,
  JournalEntry,
  Memory,
  OneTimeTask,
  RecurringMemo,
} from "@/lib/db/types";
import { getOrCreateDailyEntry } from "@/lib/db/daily-entry";
import { isUntimedPeriod } from "@/lib/activity/untimed-period";
import { getCachedUserId } from "@/lib/supabase";
import { getOrCreateDeviceId } from "./device-id";
import { enqueuePendingOperation } from "./pending-operations";
import {
  enqueueProjectionUpsertForTable,
  withSuppressedProjectionEnqueue,
} from "./projection-sync";
import { requestDebouncedSync } from "./sync-scheduler";
import {
  enqueueActivityCountDelta,
  enqueueActivityPauseChange,
  enqueueBreakDayChange,
} from "./semantic-operations";
import type { SyncTable } from "./sync-transformers";
import { recordSyncIssue } from "./sync-issues-store";
import {
  buildJournalConflictPayload,
  isJournalConflictPayload,
} from "./journal-conflict-resolution";
import type { BackupTables } from "@/lib/backup/format";
import {
  backupJournalFingerprint,
  backupOperationId,
} from "@/lib/backup/identity";
import {
  decideAppendOnlyRow,
  decideCurrentStateRow,
  isEmptyDailyPlan,
  planDailyEntryMerge,
  planJournalMerge,
} from "@/lib/backup/merge-plan";

export async function getOrCreateDailyEntryProjection(
  dateString: string
): Promise<DailyEntry> {
  return getOrCreateDailyEntry(dateString);
}

async function writeProjection(
  table: SyncTable,
  row: Record<string, unknown>,
  baseRevision?: string | null
): Promise<void> {
  await enqueueProjectionUpsertForTable(table, row, baseRevision);
  requestDebouncedSync();
}

export async function saveActivity(
  row: Activity,
  baseRevision?: string | null
): Promise<void> {
  const existing = await db.activities.get(row.id);
  if (existing) {
    await db.activities.put(row);
  } else {
    await db.activities.add(row);
  }
  await writeProjection(
    "activities",
    row as unknown as Record<string, unknown>,
    baseRevision
  );
}

export async function patchActivity(
  id: string,
  patch: Partial<Activity>
): Promise<void> {
  const existing = await db.activities.get(id);
  if (!existing) return;
  const next: Activity = {
    ...existing,
    ...patch,
    updated_at: patch.updated_at ?? now(),
  };
  await saveActivity(next, existing.updated_at);
}

export async function saveActivityGroup(
  row: ActivityGroup,
  baseRevision?: string | null
): Promise<void> {
  const existing = await db.activityGroups.get(row.id);
  if (existing) {
    await db.activityGroups.put(row);
  } else {
    await db.activityGroups.add(row);
  }
  await writeProjection(
    "activity_groups",
    row as unknown as Record<string, unknown>,
    baseRevision
  );
}

export async function patchActivityGroup(
  id: string,
  patch: Partial<ActivityGroup>
): Promise<void> {
  const existing = await db.activityGroups.get(id);
  if (!existing) return;
  const next: ActivityGroup = {
    ...existing,
    ...patch,
    updated_at: patch.updated_at ?? now(),
  };
  await saveActivityGroup(next, existing.updated_at);
}

export async function saveJournalEntry(
  row: JournalEntry,
  baseRevision?: string | null
): Promise<void> {
  const existing = await db.journalEntries.get(row.id);
  if (existing) {
    await db.journalEntries.put(row);
  } else {
    await db.journalEntries.add(row);
  }
  await writeProjection(
    "journal_entries",
    row as unknown as Record<string, unknown>,
    baseRevision
  );
}

export async function saveMemory(
  row: Memory,
  baseRevision?: string | null
): Promise<void> {
  const existing = await db.memories.get(row.id);
  if (existing) await db.memories.put(row);
  else await db.memories.add(row);
  await writeProjection(
    "memories",
    row as unknown as Record<string, unknown>,
    baseRevision
  );
}

export async function patchMemory(
  id: string,
  patch: Partial<Memory>
): Promise<void> {
  const existing = await db.memories.get(id);
  if (!existing) return;
  await saveMemory(
    { ...existing, ...patch, updated_at: patch.updated_at ?? now() },
    existing.updated_at
  );
}

/** Privacy erasure keeps only a tombstone, so a previously synced memory cannot return. */
export async function eraseMemory(row: Memory): Promise<void> {
  await saveMemory(
    {
      ...row,
      text_content: null,
      photo_paths: null,
      time_label: null,
      deleted_at: now(),
      updated_at: now(),
    },
    row.updated_at
  );
}

export async function saveTimedPeriod(
  row: ActivityPeriod,
  baseRevision?: string | null
): Promise<void> {
  if (isUntimedPeriod(row.start_time, row.end_time)) {
    // Untimed completions are derived from counts; never store them as facts.
    return;
  }
  const existing = await db.activityPeriods.get(row.id);
  if (existing) {
    await db.activityPeriods.put(row);
  } else {
    await db.activityPeriods.add(row);
  }
  await writeProjection(
    "activity_periods",
    row as unknown as Record<string, unknown>,
    baseRevision
  );
}

export async function patchTimedPeriod(
  id: string,
  patch: Partial<ActivityPeriod>
): Promise<void> {
  const existing = await db.activityPeriods.get(id);
  if (!existing) return;
  const next: ActivityPeriod = {
    ...existing,
    ...patch,
    updated_at: patch.updated_at ?? now(),
  };
  await saveTimedPeriod(next, existing.updated_at);
}

export async function saveOneTimeTask(
  row: OneTimeTask,
  baseRevision?: string | null
): Promise<void> {
  const existing = await db.oneTimeTasks.get(row.id);
  if (existing) {
    await db.oneTimeTasks.put(row);
  } else {
    await db.oneTimeTasks.add(row);
  }
  await writeProjection(
    "one_time_tasks",
    row as unknown as Record<string, unknown>,
    baseRevision
  );
}

export async function patchOneTimeTask(
  id: string,
  patch: Partial<OneTimeTask>
): Promise<void> {
  const existing = await db.oneTimeTasks.get(id);
  if (!existing) return;
  const next: OneTimeTask = {
    ...existing,
    ...patch,
    updated_at: patch.updated_at ?? now(),
  };
  await saveOneTimeTask(next, existing.updated_at);
}

export async function saveRecurringMemo(
  row: RecurringMemo,
  baseRevision?: string | null
): Promise<void> {
  const existing = await db.recurringMemos.get(row.id);
  if (existing) {
    await db.recurringMemos.put(row);
  } else {
    await db.recurringMemos.add(row);
  }
  await writeProjection(
    "recurring_memos",
    row as unknown as Record<string, unknown>,
    baseRevision
  );
}

export async function patchRecurringMemo(
  id: string,
  patch: Partial<RecurringMemo>
): Promise<void> {
  const existing = await db.recurringMemos.get(id);
  if (!existing) return;
  const next: RecurringMemo = {
    ...existing,
    ...patch,
    updated_at: patch.updated_at ?? now(),
  };
  await saveRecurringMemo(next, existing.updated_at);
}

export async function saveActivityStatusEvent(
  row: ActivityStatusEvent
): Promise<void> {
  const existing = await db.activityStatusEvents.get(row.id);
  if (existing) {
    await db.activityStatusEvents.put(row);
  } else {
    await db.activityStatusEvents.add(row);
  }
  await writeProjection(
    "activity_status_events",
    row as unknown as Record<string, unknown>,
    null
  );
}

export async function saveGroupStatusEvent(
  row: GroupStatusEvent
): Promise<void> {
  const existing = await db.groupStatusEvents.get(row.id);
  if (existing) {
    await db.groupStatusEvents.put(row);
  } else {
    await db.groupStatusEvents.add(row);
  }
  await writeProjection(
    "group_status_events",
    row as unknown as Record<string, unknown>,
    null
  );
}

export async function applyCountDelta(input: {
  date: string;
  activityId: string;
  previousCount: number;
  nextCount: number;
  reason?: "increment" | "cycle" | "reset" | "never_slip";
  completionAt?: string | null;
  operationId?: string;
}): Promise<DailyEntry> {
  const entry = await getOrCreateDailyEntryProjection(input.date);
  const counts: Record<string, number> = { ...(entry.task_counts ?? {}) };
  if (input.nextCount <= 0) delete counts[input.activityId];
  else counts[input.activityId] = input.nextCount;
  const completionTimes: Record<string, string> = {
    ...(entry.completion_times ?? {}),
  };
  if (input.completionAt)
    completionTimes[input.activityId] = input.completionAt;
  else if (input.completionAt === null)
    delete completionTimes[input.activityId];
  const timestamp = now();
  await withSuppressedProjectionEnqueue(async () => {
    await db.dailyEntries.update(entry.id, {
      task_counts: counts,
      completion_times: completionTimes,
      updated_at: timestamp,
    });
  });
  await enqueueActivityCountDelta({
    activityId: input.activityId,
    date: input.date,
    previousCount: input.previousCount,
    nextCount: input.nextCount,
    reason: input.reason,
    dailyEntryId: entry.id,
    completionAt: input.completionAt,
    operationId: input.operationId,
  });
  requestDebouncedSync();
  return {
    ...entry,
    task_counts: counts,
    completion_times: completionTimes,
    updated_at: timestamp,
  };
}

export async function applyPauseChange(input: {
  date: string;
  activityId: string;
  paused: boolean;
  operationId?: string;
}): Promise<DailyEntry> {
  const entry = await getOrCreateDailyEntryProjection(input.date);
  const pausedIds = new Set(entry.paused_task_ids ?? []);
  if (input.paused) pausedIds.add(input.activityId);
  else pausedIds.delete(input.activityId);
  const nextPaused = [...pausedIds];
  const timestamp = now();
  await withSuppressedProjectionEnqueue(async () => {
    await db.dailyEntries.update(entry.id, {
      paused_task_ids: nextPaused,
      updated_at: timestamp,
    });
  });
  await enqueueActivityPauseChange({
    activityId: input.activityId,
    date: input.date,
    paused: input.paused,
    dailyEntryId: entry.id,
    operationId: input.operationId,
  });
  requestDebouncedSync();
  return { ...entry, paused_task_ids: nextPaused, updated_at: timestamp };
}

export async function applyBreakDayChange(input: {
  date: string;
  isBreakDay: boolean;
  operationId?: string;
}): Promise<DailyEntry> {
  const entry = await getOrCreateDailyEntryProjection(input.date);
  const timestamp = now();
  await withSuppressedProjectionEnqueue(async () => {
    await db.dailyEntries.update(entry.id, {
      is_break_day: input.isBreakDay,
      updated_at: timestamp,
    });
  });
  await enqueueBreakDayChange({
    date: input.date,
    isBreakDay: input.isBreakDay,
    dailyEntryId: entry.id,
    operationId: input.operationId,
  });
  requestDebouncedSync();
  return { ...entry, is_break_day: input.isBreakDay, updated_at: timestamp };
}

export async function setCurrentActivityLocal(
  date: string,
  activityId: string | null
): Promise<DailyEntry> {
  const entry = await getOrCreateDailyEntryProjection(date);
  const timestamp = now();
  await withSuppressedProjectionEnqueue(async () => {
    await db.dailyEntries.update(entry.id, {
      current_activity_id: activityId,
      updated_at: timestamp,
    });
  });
  return { ...entry, current_activity_id: activityId, updated_at: timestamp };
}

export async function applyCompletionNote(input: {
  date: string;
  activityId: string;
  note: string | null;
  operationId?: string;
}): Promise<DailyEntry> {
  const entry = await getOrCreateDailyEntryProjection(input.date);
  const notes: Record<string, string> = { ...(entry.completion_notes ?? {}) };
  const trimmed = input.note?.trim() ?? "";
  if (trimmed) notes[input.activityId] = trimmed.slice(0, 200);
  else delete notes[input.activityId];
  const timestamp = now();
  await withSuppressedProjectionEnqueue(async () => {
    await db.dailyEntries.update(entry.id, {
      completion_notes: notes,
      updated_at: timestamp,
    });
  });
  if (getCachedUserId()) {
    await enqueuePendingOperation({
      operation_id: input.operationId ?? crypto.randomUUID(),
      account_id: getCachedUserId(),
      device_id: getOrCreateDeviceId(),
      entity_type: "daily_entry",
      entity_id: entry.id,
      operation_type: "completion.note",
      payload: {
        date: input.date,
        activity_id: input.activityId,
        daily_entry_id: entry.id,
        note: trimmed ? trimmed.slice(0, 200) : null,
      },
    });
    requestDebouncedSync();
  }
  return { ...entry, completion_notes: notes, updated_at: timestamp };
}

export interface BackupImportSummary {
  inserted: number;
  updated: number;
  unchanged: number;
  /** Rows the account already has in a newer revision than the backup. */
  keptNewer: number;
  /** Completions added to reach the backup's counts. */
  countsAdded: number;
  journalConflicts: number;
}

export interface BackupImportOptions {
  /** `syncUserKey` of the account receiving the import. */
  targetUserKey: string;
  /** Server sequence this device has applied; part of every operation id. */
  syncedSequence: number;
}

function emptyImportSummary(): BackupImportSummary {
  return {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    keptNewer: 0,
    countsAdded: 0,
    journalConflicts: 0,
  };
}

/**
 * Merge a backup into this account through the command API.
 *
 * Every change is computed against current state and enqueued with an
 * operation id derived from the backup row, so importing the same file twice
 * changes nothing and never adds counts on top of counts. A journal date whose
 * text differs becomes a conflict on Sync issues instead of an overwrite.
 *
 * Callers must sync first: counts are the difference from this device's view,
 * which is only the account's view once nothing is pending.
 */
export async function importBackup(
  tables: BackupTables,
  options: BackupImportOptions
): Promise<BackupImportSummary> {
  const summary = emptyImportSummary();
  const opId = (
    ...parts: Array<string | number | boolean | null | undefined>
  ) => backupOperationId(options.targetUserKey, options.syncedSequence, parts);

  async function importRows<T extends { id: string; updated_at: string }>(
    rows: T[],
    table: SyncTable,
    dexieTable: Table<T, string>,
    mode: "current" | "append" = "current"
  ): Promise<void> {
    for (const row of rows) {
      const local = await dexieTable.get(row.id);
      const decision =
        mode === "append"
          ? decideAppendOnlyRow(local)
          : decideCurrentStateRow(local, row);
      if (decision === "unchanged") {
        summary.unchanged += 1;
        continue;
      }
      if (decision === "keep_local") {
        summary.keptNewer += 1;
        continue;
      }
      const next = { ...row, synced_at: null };
      await dexieTable.put(next);
      await enqueueProjectionUpsertForTable(
        table,
        next as unknown as Record<string, unknown>,
        decision === "update" ? local!.updated_at : null,
        { operationId: opId(table, row.id, row.updated_at) }
      );
      summary[decision === "insert" ? "inserted" : "updated"] += 1;
    }
  }

  await importRows(tables.activityGroups, "activity_groups", db.activityGroups);
  await importRows(tables.activities, "activities", db.activities);
  await importRows(tables.recurringMemos, "recurring_memos", db.recurringMemos);
  await importRows(tables.oneTimeTasks, "one_time_tasks", db.oneTimeTasks);
  await importRows(
    tables.activityStatusEvents,
    "activity_status_events",
    db.activityStatusEvents,
    "append"
  );
  await importRows(
    tables.groupStatusEvents,
    "group_status_events",
    db.groupStatusEvents,
    "append"
  );

  for (const row of tables.dailyEntries) {
    const local = await db.dailyEntries
      .where("date")
      .equals(row.date)
      .filter((entry) => !entry.deleted_at)
      .first();
    const plan = planDailyEntryMerge(local, row);
    if (isEmptyDailyPlan(plan)) {
      summary.unchanged += 1;
      continue;
    }
    for (const change of plan.counts) {
      await applyCountDelta({
        date: row.date,
        activityId: change.activityId,
        previousCount: change.previousCount,
        nextCount: change.nextCount,
        completionAt: change.completionAt,
        operationId: opId(
          "count",
          row.date,
          change.activityId,
          change.previousCount,
          change.nextCount,
          change.completionAt
        ),
      });
      summary.countsAdded += change.nextCount - change.previousCount;
    }
    for (const activityId of plan.pauseActivityIds) {
      await applyPauseChange({
        date: row.date,
        activityId,
        paused: true,
        operationId: opId("pause", row.date, activityId),
      });
    }
    if (plan.enableBreakDay) {
      await applyBreakDayChange({
        date: row.date,
        isBreakDay: true,
        operationId: opId("break_day", row.date),
      });
    }
    for (const { activityId, note } of plan.notes) {
      await applyCompletionNote({
        date: row.date,
        activityId,
        note,
        operationId: opId("note", row.date, activityId, note),
      });
    }
    summary[local ? "updated" : "inserted"] += 1;
  }

  const dateByDailyId = new Map(
    tables.dailyEntries.map((entry) => [entry.id, entry.date])
  );
  const timedPeriods: ActivityPeriod[] = [];
  for (const period of tables.activityPeriods) {
    if (isUntimedPeriod(period.start_time, period.end_time)) continue;
    const date = dateByDailyId.get(period.daily_entry_id);
    if (date && !(await db.activityPeriods.get(period.id))) {
      const entry = await getOrCreateDailyEntryProjection(date);
      timedPeriods.push({ ...period, daily_entry_id: entry.id });
    } else {
      timedPeriods.push(period);
    }
  }
  await importRows(timedPeriods, "activity_periods", db.activityPeriods);

  for (const row of tables.journalEntries) {
    const local =
      (await db.journalEntries.get(row.id)) ??
      (await db.journalEntries
        .where("entry_date")
        .equals(row.entry_date)
        .filter((entry) => !entry.deleted_at)
        .first());
    const decision = planJournalMerge(local, row, now());
    if (decision.kind === "unchanged") {
      summary.unchanged += 1;
    } else if (decision.kind === "keep_local") {
      summary.keptNewer += 1;
    } else if (decision.kind === "conflict") {
      if (await recordBackupJournalConflict(local!, row)) {
        summary.journalConflicts += 1;
      }
    } else {
      const next =
        decision.kind === "insert"
          ? { ...row, synced_at: null }
          : { ...decision.row, synced_at: null };
      await db.journalEntries.put(next);
      await enqueueProjectionUpsertForTable(
        "journal_entries",
        next as unknown as Record<string, unknown>,
        local?.updated_at ?? null,
        { operationId: opId("journal_entries", next.id, row.updated_at) }
      );
      summary[decision.kind === "insert" ? "inserted" : "updated"] += 1;
    }
  }

  await importRows(tables.memories, "memories", db.memories);

  requestDebouncedSync();
  return summary;
}

/** Returns false when this backup's version is already on Sync issues. */
async function recordBackupJournalConflict(
  local: JournalEntry,
  backup: JournalEntry
): Promise<boolean> {
  const fingerprint = backupJournalFingerprint(
    local.id,
    backup.text_content?.trim() ?? ""
  );
  const existing = await db.syncIssues
    .where("kind")
    .equals("conflict")
    .filter(
      (issue) =>
        issue.entity_id === local.id &&
        isJournalConflictPayload(issue.payload) &&
        issue.payload.backup_fingerprint === fingerprint
    )
    .first();
  if (existing) return false;

  const payload = await buildJournalConflictPayload({
    entity_id: local.id,
    localRow: local,
    remoteRow: { ...backup, id: local.id },
    remoteDeviceId: null,
  });
  await recordSyncIssue({
    kind: "conflict",
    title: "Journal entry differs from backup",
    detail: `The backup has different text for ${backup.entry_date}.`,
    entity_type: "journal_entry",
    entity_id: local.id,
    payload: { ...payload, source: "backup", backup_fingerprint: fingerprint },
    account_id: getCachedUserId(),
  });
  return true;
}
