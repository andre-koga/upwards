import { v5 as uuidv5 } from "uuid";
import { UPWARDS_SYNC_NAMESPACE } from "@/lib/sync/natural-ids";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  ActivityStatusEvent,
  DailyEntry,
  GroupStatusEvent,
  RecurringMemo,
} from "@/lib/db/types";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupDocument,
  type BackupTables,
} from "../format";

/**
 * Format 5 carried the model the cutover retired: lifecycle as an event log,
 * recurring memos, activities with no name, and zero-length sessions. This
 * file is the only place that still knows those shapes.
 */
export interface BackupTablesV5 extends BackupTables {
  recurringMemos: RecurringMemo[];
  activityStatusEvents: ActivityStatusEvent[];
  groupStatusEvents: GroupStatusEvent[];
}

export interface BackupDocumentV5 extends Omit<
  BackupDocument,
  "format_version" | "tables"
> {
  format_version: 5;
  tables: BackupTablesV5;
}

/**
 * The same conversion the server ran (supabase/migrations/*_model_cutover.sql),
 * rule for rule, so restoring a file taken before the cutover gives the result
 * the live data got. Where the server used `now()` this uses the file's own
 * `exported_at`: the output depends only on the input, and converting the same
 * file twice gives the same rows.
 *
 * Converted routines get UUIDv5 ids from the memo id, in the namespace the
 * server used, so a restore into the same account lands on the server's rows
 * instead of creating each routine a second time.
 */

const STALE_RUNNING_MS = 24 * 60 * 60 * 1000;
const STALE_CLOSE_AFTER_MS = 60 * 60 * 1000;

export function routinesGroupId(userKey: string): string {
  return uuidv5(`a6:routines-group:${userKey}`, UPWARDS_SYNC_NAMESPACE);
}

export function memoActivityId(memoId: string): string {
  return uuidv5(`a6:memo:${memoId}`, UPWARDS_SYNC_NAMESPACE);
}

/** The latest event (by write time) that enters the given status, if any. */
function latestEntered<
  E extends { entity_id: string; created_at: string; next_value: boolean },
>(events: E[], isStatus: (event: E) => boolean): Map<string, E> {
  const latest = new Map<string, E>();
  for (const event of events) {
    if (!isStatus(event) || !event.next_value) continue;
    const current = latest.get(event.entity_id);
    if (!current || event.created_at > current.created_at) {
      latest.set(event.entity_id, event);
    }
  }
  return latest;
}

/** Whose last "deleted" event says the item is deleted. */
function deletedByEvents<
  E extends {
    entity_id: string;
    created_at: string;
    next_value: boolean;
    status_type: string;
  },
>(events: E[]): Set<string> {
  const last = new Map<string, E>();
  for (const event of events) {
    if (event.status_type !== "deleted") continue;
    const current = last.get(event.entity_id);
    if (!current || event.created_at > current.created_at) {
      last.set(event.entity_id, event);
    }
  }
  return new Set(
    [...last.values()].filter((e) => e.next_value).map((e) => e.entity_id)
  );
}

function isZeroLength(period: ActivityPeriod): boolean {
  return (
    !!period.end_time &&
    new Date(period.start_time).getTime() ===
      new Date(period.end_time).getTime()
  );
}

/** Sessions: zero-length ones fold into the day; forgotten running ones close. */
function convertPeriods(
  periods: ActivityPeriod[],
  entries: DailyEntry[],
  activities: Map<string, Activity>,
  exportedAt: string
): ActivityPeriod[] {
  const byEntry = new Map(entries.map((entry) => [entry.id, entry]));

  // A zero-length session donates its time and note to the day only when that
  // day's count reached the target; the latest one wins.
  const donors = new Map<string, ActivityPeriod>();
  for (const period of periods) {
    if (period.deleted_at || !isZeroLength(period)) continue;
    const key = `${period.daily_entry_id}:${period.activity_id}`;
    const current = donors.get(key);
    if (!current || period.start_time > current.start_time) {
      donors.set(key, period);
    }
  }
  for (const period of donors.values()) {
    const entry = period.daily_entry_id
      ? byEntry.get(period.daily_entry_id)
      : undefined;
    const activity = activities.get(period.activity_id);
    if (!entry || !activity) continue;
    const count = entry.task_counts?.[period.activity_id] ?? 0;
    if (count < (activity.completion_target ?? 1)) continue;
    if (!entry.completion_times?.[period.activity_id]) {
      entry.completion_times = {
        ...(entry.completion_times ?? {}),
        [period.activity_id]: period.start_time,
      };
    }
    if (period.note && !entry.completion_notes?.[period.activity_id]) {
      entry.completion_notes = {
        ...(entry.completion_notes ?? {}),
        [period.activity_id]: period.note,
      };
    }
  }

  const exportedMs = new Date(exportedAt).getTime();
  return periods
    .filter((period) => !isZeroLength(period))
    .map((period) => {
      const stale =
        !period.end_time &&
        !period.deleted_at &&
        exportedMs - new Date(period.start_time).getTime() > STALE_RUNNING_MS;
      return {
        ...period,
        daily_entry_id: null,
        end_time: stale
          ? new Date(
              new Date(period.start_time).getTime() + STALE_CLOSE_AFTER_MS
            ).toISOString()
          : period.end_time,
        updated_at: stale ? exportedAt : period.updated_at,
      };
    });
}

export function migrateV5ToV6(doc: BackupDocumentV5): BackupDocument {
  const t = doc.tables;
  const exportedAt = doc.exported_at;

  // ── Lifecycle: events become timestamps ────────────────────────────────────
  const archivedActivityEvents = latestEntered(
    t.activityStatusEvents,
    (e) => e.status_type === "archived" || e.status_type === "completed"
  );
  const archivedGroupEvents = latestEntered(
    t.groupStatusEvents,
    (e) => e.status_type === "archived"
  );
  const deletedActivities = deletedByEvents(t.activityStatusEvents);
  const deletedGroups = deletedByEvents(t.groupStatusEvents);

  const groupsById = new Map(t.activityGroups.map((g) => [g.id, g]));
  const entries = t.dailyEntries.map((entry) => ({ ...entry }));

  const usedActivityIds = new Set<string>();
  for (const entry of entries) {
    for (const map of [
      entry.task_counts,
      entry.completion_notes,
      entry.completion_times,
    ]) {
      for (const id of Object.keys(map ?? {})) usedActivityIds.add(id);
    }
  }
  for (const period of t.activityPeriods) {
    if (!period.deleted_at) usedActivityIds.add(period.activity_id);
  }

  const takenNames = (groupId: string, exceptId: string) =>
    new Set(
      t.activities
        .filter((a) => a.group_id === groupId && a.id !== exceptId && a.name)
        .map((a) => a.name!.toLowerCase())
    );

  const groups: ActivityGroup[] = t.activityGroups.map((group) => {
    const flagged = group.is_archived === true;
    const archivedAt =
      flagged && !group.deleted_at
        ? (archivedGroupEvents.get(group.id)?.effective_at ?? group.updated_at)
        : null;
    return {
      ...group,
      archived_at: archivedAt,
      deleted_at:
        group.deleted_at ?? (deletedGroups.has(group.id) ? exportedAt : null),
    };
  });

  const activities: Activity[] = t.activities.map((activity) => {
    const flagged =
      activity.is_archived === true || Boolean(activity.completed_at);
    const archivedAt =
      flagged && !activity.deleted_at
        ? (archivedActivityEvents.get(activity.id)?.effective_at ??
          activity.completed_at ??
          activity.updated_at)
        : null;
    let deletedAt =
      activity.deleted_at ??
      (deletedActivities.has(activity.id) ? exportedAt : null);

    // An activity with no name timed "a whole group". Name it after the group,
    // make it time-only, and delete it when it holds nothing.
    let name = activity.name;
    let routine = activity.routine;
    let tracksTime = activity.routine !== "never";
    if (name === null || name === undefined) {
      const groupName = groupsById.get(activity.group_id)?.name ?? "General";
      name = takenNames(activity.group_id, activity.id).has(
        groupName.toLowerCase()
      )
        ? `${groupName} · general`
        : groupName;
      routine = routine ?? "anytime";
      tracksTime = true;
      if (!usedActivityIds.has(activity.id)) {
        deletedAt = deletedAt ?? exportedAt;
      }
    }

    return {
      ...activity,
      name,
      routine,
      archived_at: archivedAt,
      deleted_at: deletedAt,
      tracks_time: tracksTime,
      is_pinned: false,
    };
  });

  // ── Recurring memos become check-only activities in a Routines group ──────
  if (t.recurringMemos.length > 0) {
    const userKey = doc.source_user_key ?? "unknown";
    const groupId = routinesGroupId(userKey);
    groups.push({
      id: groupId,
      name: "Routines",
      color: null,
      order_index: null,
      is_archived: false,
      archived_at: null,
      created_at: exportedAt,
      updated_at: exportedAt,
      synced_at: null,
      deleted_at: null,
    });
    for (const memo of t.recurringMemos) {
      const enabled = memo.is_enabled !== false;
      activities.push({
        id: memoActivityId(memo.id),
        group_id: groupId,
        name: memo.title,
        routine: memo.routine,
        completion_target: 1,
        is_archived: !enabled,
        completed_at: null,
        archived_at: enabled ? null : memo.updated_at,
        tracks_time: false,
        is_pinned: memo.is_pinned === true,
        order_index: null,
        created_at: memo.created_at,
        updated_at: memo.updated_at,
        synced_at: null,
        deleted_at: memo.deleted_at,
      });
    }
  }

  const activitiesById = new Map(activities.map((a) => [a.id, a]));
  const activityPeriods = convertPeriods(
    t.activityPeriods,
    entries,
    activitiesById,
    exportedAt
  );

  const {
    recurringMemos: _memos,
    activityStatusEvents: _activityEvents,
    groupStatusEvents: _groupEvents,
    ...kept
  } = t;
  void _memos;
  void _activityEvents;
  void _groupEvents;

  return {
    ...doc,
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    tables: {
      ...kept,
      activityGroups: groups,
      activities,
      dailyEntries: entries,
      activityPeriods,
    },
  };
}
