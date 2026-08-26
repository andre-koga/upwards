import { db, newId, now } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityStatusEvent,
  ActivityStatusType,
  GroupStatusEvent,
  GroupStatusType,
} from "@/lib/db/types";
import { endOfDay, shiftDate, startOfDay } from "@/lib/time-utils";
import {
  saveActivityStatusEvent,
  saveGroupStatusEvent,
} from "@/lib/sync/mutate-synced";

export type { ActivityStatusType, GroupStatusType };

const ACTIVITY_ARCHIVE_STATUS_TYPES: ReadonlySet<string> = new Set([
  "archived",
  "completed",
]);

/**
 * When a status starts applying for calendar-day visibility.
 * - archived / completed (enter): hide from the *next* day (action day still visible).
 * - deleted (enter): hide from the *action day* onward (today inclusive).
 * - leaving any status: applies from the action day.
 */
export function effectiveAtForStatusOn(
  actionDate: Date,
  entering: boolean,
  statusType: ActivityStatusType | GroupStatusType
): string {
  if (!entering) {
    return startOfDay(actionDate).toISOString();
  }
  if (statusType === "deleted") {
    return startOfDay(actionDate).toISOString();
  }
  return shiftDate(startOfDay(actionDate), 1).toISOString();
}

function statusTypesMatch(eventType: string, requestedType: string): boolean {
  if (requestedType === "archived" || requestedType === "completed") {
    return ACTIVITY_ARCHIVE_STATUS_TYPES.has(eventType);
  }
  return eventType === requestedType;
}

function reduceStatusAsOf<
  T extends {
    status_type: string;
    next_value: boolean;
    effective_at: string;
    created_at: string;
    deleted_at: string | null;
  },
>(events: T[], statusType: string, viewDate: Date): boolean {
  const cutoff = endOfDay(viewDate).toISOString();
  let value = false;
  const relevant = events
    .filter(
      (e) =>
        !e.deleted_at &&
        statusTypesMatch(e.status_type, statusType) &&
        e.effective_at <= cutoff
    )
    // Sort by when the event was actually written so that the most recently
    // recorded action always wins. effective_at controls *when* an event
    // starts applying (the filter above), but created_at determines which
    // write is authoritative among all in-effect events. This prevents a
    // "complete then undo on the same day" scenario where the undo event
    // has an effective_at of startOfDay(today) while the completed event
    // has effective_at of startOfDay(tomorrow/today+1), causing the
    // completed event to sort last and incorrectly win.
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const event of relevant) {
    value = event.next_value;
  }
  return value;
}

export function isActivityStatusAsOf(
  events: ActivityStatusEvent[],
  statusType: ActivityStatusType,
  viewDate: Date,
  legacyFallback?: Activity | null
): boolean {
  if (events.length > 0) {
    return reduceStatusAsOf(events, statusType, viewDate);
  }
  if (!legacyFallback) return false;
  if (
    (statusType === "archived" || statusType === "completed") &&
    (legacyFallback.is_archived || legacyFallback.completed_at)
  ) {
    const ref =
      legacyFallback.completed_at ||
      legacyFallback.updated_at ||
      legacyFallback.created_at;
    const hideFrom = shiftDate(startOfDay(new Date(ref)), 1);
    return endOfDay(viewDate).getTime() >= hideFrom.getTime();
  }
  if (statusType === "deleted" && legacyFallback.deleted_at) {
    const hideFrom = startOfDay(new Date(legacyFallback.deleted_at));
    return endOfDay(viewDate).getTime() >= hideFrom.getTime();
  }
  return false;
}

export function isGroupStatusAsOf(
  events: GroupStatusEvent[],
  statusType: GroupStatusType,
  viewDate: Date,
  legacyFallback?: ActivityGroup | null
): boolean {
  if (events.length > 0) {
    return reduceStatusAsOf(events, statusType, viewDate);
  }
  if (!legacyFallback) return false;
  if (statusType === "archived" && legacyFallback.is_archived) {
    const ref = legacyFallback.updated_at || legacyFallback.created_at;
    const hideFrom = shiftDate(startOfDay(new Date(ref)), 1);
    return endOfDay(viewDate).getTime() >= hideFrom.getTime();
  }
  if (statusType === "deleted" && legacyFallback.deleted_at) {
    const hideFrom = startOfDay(new Date(legacyFallback.deleted_at));
    return endOfDay(viewDate).getTime() >= hideFrom.getTime();
  }
  return false;
}

export async function appendActivityStatusEvent(
  activityId: string,
  statusType: ActivityStatusType,
  nextValue: boolean,
  actionDate: Date = new Date()
): Promise<void> {
  const timestamp = now();
  const event: ActivityStatusEvent = {
    id: newId(),
    entity_id: activityId,
    status_type: statusType,
    next_value: nextValue,
    effective_at: effectiveAtForStatusOn(actionDate, nextValue, statusType),
    created_at: timestamp,
    updated_at: timestamp,
    synced_at: null,
    deleted_at: null,
  };
  await saveActivityStatusEvent(event);
}

export async function appendGroupStatusEvent(
  groupId: string,
  statusType: GroupStatusType,
  nextValue: boolean,
  actionDate: Date = new Date()
): Promise<void> {
  const timestamp = now();
  const event: GroupStatusEvent = {
    id: newId(),
    entity_id: groupId,
    status_type: statusType,
    next_value: nextValue,
    effective_at: effectiveAtForStatusOn(actionDate, nextValue, statusType),
    created_at: timestamp,
    updated_at: timestamp,
    synced_at: null,
    deleted_at: null,
  };
  await saveGroupStatusEvent(event);
}

export async function loadAllActivityStatusEvents(): Promise<
  ActivityStatusEvent[]
> {
  return db.activityStatusEvents.filter((e) => !e.deleted_at).toArray();
}

export async function loadAllGroupStatusEvents(): Promise<GroupStatusEvent[]> {
  return db.groupStatusEvents.filter((e) => !e.deleted_at).toArray();
}

export function buildActivityEventsByEntityId(
  events: ActivityStatusEvent[]
): Map<string, ActivityStatusEvent[]> {
  const map = new Map<string, ActivityStatusEvent[]>();
  for (const event of events) {
    const list = map.get(event.entity_id) ?? [];
    list.push(event);
    map.set(event.entity_id, list);
  }
  return map;
}

export function buildGroupEventsByEntityId(
  events: GroupStatusEvent[]
): Map<string, GroupStatusEvent[]> {
  const map = new Map<string, GroupStatusEvent[]>();
  for (const event of events) {
    const list = map.get(event.entity_id) ?? [];
    list.push(event);
    map.set(event.entity_id, list);
  }
  return map;
}
