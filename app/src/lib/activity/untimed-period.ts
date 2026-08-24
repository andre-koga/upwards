import { db, now, newId } from "@/lib/db";
import type { Activity, ActivityPeriod } from "@/lib/db/types";
import { getOrCreateDailyEntry } from "@/lib/db/daily-entry";
import { isHiddenGroupDefaultActivity } from "@/lib/activity/hidden-default";
import {
  calendarDatesOverlappingEffectiveDay,
  effectiveDayEndMs,
  effectiveDayStartMs,
  periodBelongsToDay,
  resolvePeriodFromLogicalDay,
} from "@/lib/activity/period-day-utils";
import { normalizeSessionNote } from "@/lib/activity/session-note";
import { timeToSeconds } from "@/lib/time-utils";

const ensureInflight = new Map<string, Promise<boolean>>();

/** Closed period whose start and end are the same instant — a completion, not a span. */
export function isUntimedPeriod(
  startTime: string,
  endTime: string | null | undefined
): boolean {
  if (!endTime) return false;
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  return Number.isFinite(startMs) && startMs === endMs;
}

/** Point-in-time completion belongs to the effective day `[dayStart, dayEnd)`. */
export function untimedPeriodBelongsToDay(
  startMs: number,
  dateString: string
): boolean {
  const dayStart = effectiveDayStartMs(dateString);
  const dayEnd = effectiveDayEndMs(dateString);
  return startMs >= dayStart && startMs < dayEnd;
}

export function buildUntimedPeriod(params: {
  id: string;
  dailyEntryId: string;
  activityId: string;
  completedAt: string;
  note?: string | null;
}): ActivityPeriod {
  return {
    id: params.id,
    daily_entry_id: params.dailyEntryId,
    activity_id: params.activityId,
    start_time: params.completedAt,
    end_time: params.completedAt,
    note: params.note ?? null,
    created_at: params.completedAt,
    updated_at: params.completedAt,
    synced_at: null,
    deleted_at: null,
  };
}

export type UntimedCompletionAction = "create" | "tombstone" | "none";

export function untimedCompletionAction(params: {
  previousCount: number;
  nextCount: number;
  target: number;
  neverSlip?: boolean;
}): UntimedCompletionAction {
  if (params.neverSlip) return "none";
  const wasComplete = params.previousCount >= params.target;
  const isComplete = params.nextCount >= params.target;
  if (!wasComplete && isComplete) return "create";
  if (wasComplete && !isComplete) return "tombstone";
  return "none";
}

export function periodsBelongingToDay(
  periods: ActivityPeriod[],
  dateString: string,
  nowMs: number
): ActivityPeriod[] {
  return periods.filter((period) => {
    if (period.deleted_at) return false;
    const startMs = new Date(period.start_time).getTime();
    const endMs = period.end_time ? new Date(period.end_time).getTime() : null;
    return periodBelongsToDay(startMs, endMs, dateString, nowMs);
  });
}

export function findUntimedAmong(
  periods: ActivityPeriod[],
  activityId: string
): ActivityPeriod | undefined {
  return periods.find(
    (period) =>
      !period.deleted_at &&
      period.activity_id === activityId &&
      isUntimedPeriod(period.start_time, period.end_time)
  );
}

export type ClosedSessionTimesResult =
  | { ok: true; startIso: string; endIso: string }
  | { ok: false; error: "one_time" | "same_time" };

/**
 * Resolve start/end for a closed session. Both empty → untimed (keep the
 * existing completion instant, or created_at). Both set → a timed span.
 */
export function resolveClosedSessionTimes(params: {
  startTime: string;
  endTime: string;
  logicalDateStr: string;
  resetMinutes: number;
  existingStartIso: string;
  existingEndIso: string | null;
  createdAt: string;
}): ClosedSessionTimesResult {
  const startEmpty = !params.startTime;
  const endEmpty = !params.endTime;

  if (startEmpty && endEmpty) {
    const completionIso = isUntimedPeriod(
      params.existingStartIso,
      params.existingEndIso
    )
      ? params.existingStartIso
      : params.createdAt;
    return { ok: true, startIso: completionIso, endIso: completionIso };
  }

  if (startEmpty || endEmpty) {
    return { ok: false, error: "one_time" };
  }

  if (timeToSeconds(params.endTime) === timeToSeconds(params.startTime)) {
    return { ok: false, error: "same_time" };
  }

  const resolved = resolvePeriodFromLogicalDay(
    params.logicalDateStr,
    params.startTime,
    params.endTime,
    params.resetMinutes
  );
  return { ok: true, startIso: resolved.startIso, endIso: resolved.endIso };
}

export async function listPeriodsForActivityOnDay(
  activityId: string,
  dateString: string
): Promise<ActivityPeriod[]> {
  const datesToQuery = calendarDatesOverlappingEffectiveDay(dateString);
  const entries = await db.dailyEntries
    .where("date")
    .anyOf(datesToQuery)
    .filter((entry) => !entry.deleted_at)
    .toArray();
  if (entries.length === 0) return [];

  const entryIds = new Set(entries.map((entry) => entry.id));
  const nowMs = Date.now();
  const candidates = await db.activityPeriods
    .where("activity_id")
    .equals(activityId)
    .filter(
      (period) =>
        !period.deleted_at &&
        !!period.daily_entry_id &&
        entryIds.has(period.daily_entry_id)
    )
    .toArray();

  return periodsBelongingToDay(candidates, dateString, nowMs);
}

export async function findUntimedPeriodForActivityOnDay(
  activityId: string,
  dateString: string
): Promise<ActivityPeriod | undefined> {
  const periods = await listPeriodsForActivityOnDay(activityId, dateString);
  return findUntimedAmong(periods, activityId);
}

async function ensureUntimedCompletionPeriodImpl(
  activityId: string,
  dateString: string
): Promise<boolean> {
  const existing = await listPeriodsForActivityOnDay(activityId, dateString);
  if (existing.length > 0) return false;

  const entry = await getOrCreateDailyEntry(dateString);
  const completedAt = now();
  await db.activityPeriods.add(
    buildUntimedPeriod({
      id: newId(),
      dailyEntryId: entry.id,
      activityId,
      completedAt,
    })
  );
  return true;
}

export async function ensureUntimedCompletionPeriod(params: {
  activityId: string;
  dateString: string;
}): Promise<boolean> {
  const key = `${params.dateString}:${params.activityId}`;
  const pending = ensureInflight.get(key);
  if (pending) return pending;

  const promise = ensureUntimedCompletionPeriodImpl(
    params.activityId,
    params.dateString
  ).finally(() => {
    ensureInflight.delete(key);
  });
  ensureInflight.set(key, promise);
  return promise;
}

export async function tombstoneUntimedPeriodsForActivityOnDay(params: {
  activityId: string;
  dateString: string;
}): Promise<number> {
  const periods = await listPeriodsForActivityOnDay(
    params.activityId,
    params.dateString
  );
  const n = now();
  const untimed = periods.filter((period) =>
    isUntimedPeriod(period.start_time, period.end_time)
  );
  await Promise.all(
    untimed.map((period) =>
      db.activityPeriods.update(period.id, {
        deleted_at: n,
        updated_at: n,
      })
    )
  );
  return untimed.length;
}

export async function backfillUntimedCompletionsForDay(params: {
  dateString: string;
  activities: Activity[];
  taskCounts: Record<string, number>;
}): Promise<number> {
  let created = 0;
  for (const activity of params.activities) {
    if (activity.routine === "never") continue;
    if (isHiddenGroupDefaultActivity(activity)) continue;
    const target = activity.completion_target ?? 1;
    const count = params.taskCounts[activity.id] || 0;
    if (count < target) continue;
    const didCreate = await ensureUntimedCompletionPeriod({
      activityId: activity.id,
      dateString: params.dateString,
    });
    if (didCreate) created += 1;
  }
  return created;
}

/** Convert an untimed completion into a running or timed session, keeping the note. */
export async function adoptUntimedPeriodForSession(params: {
  activityId: string;
  dateString: string;
  dailyEntryId: string;
  startIso: string;
  endIso: string | null;
  note?: string | null;
}): Promise<ActivityPeriod | null> {
  const untimed = await findUntimedPeriodForActivityOnDay(
    params.activityId,
    params.dateString
  );
  if (!untimed) return null;

  const n = now();
  const nextNote =
    params.note !== undefined
      ? (normalizeSessionNote(params.note) ?? untimed.note)
      : untimed.note;
  await db.activityPeriods.update(untimed.id, {
    daily_entry_id: params.dailyEntryId,
    start_time: params.startIso,
    end_time: params.endIso,
    note: nextNote,
    updated_at: n,
  });
  return {
    ...untimed,
    daily_entry_id: params.dailyEntryId,
    start_time: params.startIso,
    end_time: params.endIso,
    note: nextNote,
    updated_at: n,
  };
}
