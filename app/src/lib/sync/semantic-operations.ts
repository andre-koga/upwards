import { newId } from "@/lib/db";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import { enqueuePendingOperation } from "@/lib/sync/pending-operations";
import { getCachedUserId } from "@/lib/supabase";

export interface RecordCountDeltaInput {
  activityId: string;
  date: string;
  previousCount: number;
  nextCount: number;
  /** Optional never-slip / reset semantics for reviewers. */
  reason?: "increment" | "cycle" | "reset" | "never_slip";
}

/**
 * Enqueue a semantic count-change operation. Local projections still store the
 * full task_counts map; this dual-writes an append-only op for future sequence sync.
 */
export async function enqueueActivityCountDelta(
  input: RecordCountDeltaInput & { dailyEntryId?: string | null }
): Promise<void> {
  const delta = input.nextCount - input.previousCount;
  if (delta === 0) return;

  await enqueuePendingOperation({
    operation_id: newId(),
    account_id: getCachedUserId(),
    device_id: getOrCreateDeviceId(),
    entity_type: "daily_entry",
    entity_id: input.activityId,
    operation_type: "count.delta",
    payload: {
      activity_id: input.activityId,
      date: input.date,
      delta,
      previous_count: input.previousCount,
      next_count: input.nextCount,
      reason: input.reason ?? (delta > 0 ? "increment" : "cycle"),
      daily_entry_id: input.dailyEntryId ?? null,
    },
  });
}

export async function enqueueActivityPauseChange(input: {
  activityId: string;
  date: string;
  paused: boolean;
  dailyEntryId?: string | null;
}): Promise<void> {
  await enqueuePendingOperation({
    operation_id: newId(),
    account_id: getCachedUserId(),
    device_id: getOrCreateDeviceId(),
    entity_type: "daily_entry",
    entity_id: input.activityId,
    operation_type: input.paused ? "pause.enable" : "pause.disable",
    payload: {
      activity_id: input.activityId,
      date: input.date,
      paused: input.paused,
      daily_entry_id: input.dailyEntryId ?? null,
    },
  });
}

export async function enqueueBreakDayChange(input: {
  date: string;
  isBreakDay: boolean;
  dailyEntryId?: string | null;
}): Promise<void> {
  await enqueuePendingOperation({
    operation_id: newId(),
    account_id: getCachedUserId(),
    device_id: getOrCreateDeviceId(),
    entity_type: "daily_entry",
    entity_id: input.dailyEntryId ?? null,
    operation_type: input.isBreakDay ? "break_day.enable" : "break_day.disable",
    payload: {
      date: input.date,
      is_break_day: input.isBreakDay,
    },
  });
}
