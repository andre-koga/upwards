import { db, now } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  ActivityStatusEvent,
  DailyEntry,
  GroupStatusEvent,
  JournalEntry,
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
}): Promise<DailyEntry> {
  const entry = await getOrCreateDailyEntryProjection(input.date);
  const counts: Record<string, number> = { ...(entry.task_counts ?? {}) };
  if (input.nextCount <= 0) delete counts[input.activityId];
  else counts[input.activityId] = input.nextCount;
  const timestamp = now();
  await withSuppressedProjectionEnqueue(async () => {
    await db.dailyEntries.update(entry.id, {
      task_counts: counts,
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
  });
  requestDebouncedSync();
  return { ...entry, task_counts: counts, updated_at: timestamp };
}

export async function applyPauseChange(input: {
  date: string;
  activityId: string;
  paused: boolean;
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
  });
  requestDebouncedSync();
  return { ...entry, paused_task_ids: nextPaused, updated_at: timestamp };
}

export async function applyBreakDayChange(input: {
  date: string;
  isBreakDay: boolean;
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
      operation_id: crypto.randomUUID(),
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

export interface BackupImportData {
  activityGroups?: ActivityGroup[];
  activities?: Activity[];
  dailyEntries?: DailyEntry[];
  activityPeriods?: ActivityPeriod[];
  journalEntries?: JournalEntry[];
  oneTimeTasks?: OneTimeTask[];
  recurringMemos?: RecurringMemo[];
  activityStatusEvents?: ActivityStatusEvent[];
  groupStatusEvents?: GroupStatusEvent[];
}

/** Restore a local backup through the command API so synced tables enqueue ops. */
export async function importBackup(data: BackupImportData): Promise<void> {
  for (const row of data.activityGroups ?? []) {
    await saveActivityGroup(row);
  }
  for (const row of data.activities ?? []) {
    await saveActivity(row);
  }
  if (data.dailyEntries?.length) {
    await withSuppressedProjectionEnqueue(async () => {
      for (const row of data.dailyEntries ?? []) {
        await db.dailyEntries.put(row);
      }
    });
    for (const row of data.dailyEntries) {
      for (const [activityId, count] of Object.entries(
        row.task_counts ?? {}
      )) {
        if (count > 0) {
          await enqueueActivityCountDelta({
            activityId,
            date: row.date,
            previousCount: 0,
            nextCount: count,
            dailyEntryId: row.id,
          });
        }
      }
      for (const activityId of row.paused_task_ids ?? []) {
        await enqueueActivityPauseChange({
          activityId,
          date: row.date,
          paused: true,
          dailyEntryId: row.id,
        });
      }
      if (row.is_break_day) {
        await enqueueBreakDayChange({
          date: row.date,
          isBreakDay: true,
          dailyEntryId: row.id,
        });
      }
      for (const [activityId, note] of Object.entries(
        row.completion_notes ?? {}
      )) {
        if (note) {
          await applyCompletionNote({
            date: row.date,
            activityId,
            note,
          });
        }
      }
    }
  }
  for (const row of data.activityPeriods ?? []) {
    await saveTimedPeriod(row);
  }
  for (const row of data.journalEntries ?? []) {
    await saveJournalEntry(row);
  }
  for (const row of data.oneTimeTasks ?? []) {
    await saveOneTimeTask(row);
  }
  for (const row of data.recurringMemos ?? []) {
    await saveRecurringMemo(row);
  }
  for (const row of data.activityStatusEvents ?? []) {
    await saveActivityStatusEvent(row);
  }
  for (const row of data.groupStatusEvents ?? []) {
    await saveGroupStatusEvent(row);
  }
}
