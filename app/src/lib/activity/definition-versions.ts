import { db, now, newId } from "@/lib/db";
import type {
  Activity,
  ActivityDefinitionVersion,
  ActivityGroup,
  GroupDefinitionVersion,
} from "@/lib/db/types";
import { toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import { enqueuePendingOperation } from "@/lib/sync/pending-operations";
import { getCachedUserId } from "@/lib/supabase";

export const DEFINITION_SCHEMA_VERSION = 1;

export type ActivityDefinitionFields = Pick<
  ActivityDefinitionVersion,
  "name" | "routine" | "completion_target" | "group_id" | "order_index"
>;

export type GroupDefinitionFields = Pick<
  GroupDefinitionVersion,
  "name" | "color" | "order_index"
>;

function definitionFieldsFromActivity(
  activity: Activity
): ActivityDefinitionFields {
  return {
    name: activity.name,
    routine: activity.routine,
    completion_target: activity.completion_target,
    group_id: activity.group_id,
    order_index: activity.order_index,
  };
}

function definitionFieldsFromGroup(
  group: ActivityGroup
): GroupDefinitionFields {
  return {
    name: group.name,
    color: group.color,
    order_index: group.order_index,
  };
}

function activityDefinitionChanged(
  previous: ActivityDefinitionFields,
  next: ActivityDefinitionFields
): boolean {
  return (
    previous.name !== next.name ||
    previous.routine !== next.routine ||
    previous.completion_target !== next.completion_target ||
    previous.group_id !== next.group_id ||
    previous.order_index !== next.order_index
  );
}

function groupDefinitionChanged(
  previous: GroupDefinitionFields,
  next: GroupDefinitionFields
): boolean {
  return (
    previous.name !== next.name ||
    previous.color !== next.color ||
    previous.order_index !== next.order_index
  );
}

export async function getLatestActivityDefinitionVersion(
  activityId: string
): Promise<ActivityDefinitionVersion | null> {
  const rows = await db.activityDefinitionVersions
    .where("activity_id")
    .equals(activityId)
    .filter((row) => !row.deleted_at)
    .toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    const byEffective = b.effective_from.localeCompare(a.effective_from);
    if (byEffective !== 0) return byEffective;
    return b.recorded_at.localeCompare(a.recorded_at);
  });
  return rows[0] ?? null;
}

export async function getLatestGroupDefinitionVersion(
  groupId: string
): Promise<GroupDefinitionVersion | null> {
  const rows = await db.groupDefinitionVersions
    .where("group_id")
    .equals(groupId)
    .filter((row) => !row.deleted_at)
    .toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    const byEffective = b.effective_from.localeCompare(a.effective_from);
    if (byEffective !== 0) return byEffective;
    return b.recorded_at.localeCompare(a.recorded_at);
  });
  return rows[0] ?? null;
}

export interface AppendActivityDefinitionInput {
  activity: Activity;
  /** Logical date the definition begins applying. Defaults to effective today. */
  effectiveFrom?: string;
  /** When true, always append even if fields match the latest version. */
  force?: boolean;
  enqueue?: boolean;
}

export async function appendActivityDefinitionVersion(
  input: AppendActivityDefinitionInput
): Promise<ActivityDefinitionVersion | null> {
  const fields = definitionFieldsFromActivity(input.activity);
  const latest = await getLatestActivityDefinitionVersion(input.activity.id);
  if (
    !input.force &&
    latest &&
    !activityDefinitionChanged(definitionFieldsFromVersion(latest), fields)
  ) {
    return null;
  }

  const deviceId = getOrCreateDeviceId();
  const operationId = newId();
  const recordedAt = now();
  const effectiveFrom =
    input.effectiveFrom ?? getEffectiveToday(new Date(recordedAt));

  const version: ActivityDefinitionVersion = {
    id: newId(),
    activity_id: input.activity.id,
    parent_version_id: latest?.id ?? null,
    effective_from: effectiveFrom,
    recorded_at: recordedAt,
    server_sequence: null,
    operation_id: operationId,
    device_id: deviceId,
    ...fields,
    schema_version: DEFINITION_SCHEMA_VERSION,
    created_at: recordedAt,
    deleted_at: null,
  };

  await db.activityDefinitionVersions.add(version);

  if (input.enqueue !== false) {
    await enqueuePendingOperation({
      operation_id: operationId,
      account_id: getCachedUserId(),
      device_id: deviceId,
      entity_type: "activity_definition",
      entity_id: input.activity.id,
      operation_type: latest ? "definition.update" : "definition.create",
      payload: {
        version_id: version.id,
        parent_version_id: version.parent_version_id,
        effective_from: version.effective_from,
        fields,
      },
      base_revision: latest?.id ?? null,
    });
  }

  return version;
}

export interface AppendGroupDefinitionInput {
  group: ActivityGroup;
  effectiveFrom?: string;
  force?: boolean;
  enqueue?: boolean;
}

export async function appendGroupDefinitionVersion(
  input: AppendGroupDefinitionInput
): Promise<GroupDefinitionVersion | null> {
  const fields = definitionFieldsFromGroup(input.group);
  const latest = await getLatestGroupDefinitionVersion(input.group.id);
  if (
    !input.force &&
    latest &&
    !groupDefinitionChanged(
      {
        name: latest.name,
        color: latest.color,
        order_index: latest.order_index,
      },
      fields
    )
  ) {
    return null;
  }

  const deviceId = getOrCreateDeviceId();
  const operationId = newId();
  const recordedAt = now();
  const effectiveFrom =
    input.effectiveFrom ?? getEffectiveToday(new Date(recordedAt));

  const version: GroupDefinitionVersion = {
    id: newId(),
    group_id: input.group.id,
    parent_version_id: latest?.id ?? null,
    effective_from: effectiveFrom,
    recorded_at: recordedAt,
    server_sequence: null,
    operation_id: operationId,
    device_id: deviceId,
    ...fields,
    schema_version: DEFINITION_SCHEMA_VERSION,
    created_at: recordedAt,
    deleted_at: null,
  };

  await db.groupDefinitionVersions.add(version);

  if (input.enqueue !== false) {
    await enqueuePendingOperation({
      operation_id: operationId,
      account_id: getCachedUserId(),
      device_id: deviceId,
      entity_type: "group_definition",
      entity_id: input.group.id,
      operation_type: latest ? "definition.update" : "definition.create",
      payload: {
        version_id: version.id,
        parent_version_id: version.parent_version_id,
        effective_from: version.effective_from,
        fields,
      },
      base_revision: latest?.id ?? null,
    });
  }

  return version;
}

function definitionFieldsFromVersion(
  version: ActivityDefinitionVersion
): ActivityDefinitionFields {
  return {
    name: version.name,
    routine: version.routine,
    completion_target: version.completion_target,
    group_id: version.group_id,
    order_index: version.order_index,
  };
}

/** Seed a baseline version from the current projection row (migration / backfill). */
export async function ensureBaselineActivityDefinition(
  activity: Activity
): Promise<ActivityDefinitionVersion> {
  const existing = await getLatestActivityDefinitionVersion(activity.id);
  if (existing) return existing;

  const createdLogicalDay = getEffectiveToday(new Date(activity.created_at));
  const version = await appendActivityDefinitionVersion({
    activity,
    effectiveFrom: createdLogicalDay,
    force: true,
    enqueue: false,
  });
  if (!version) {
    throw new Error("Failed to create baseline activity definition version");
  }
  return version;
}

export async function ensureBaselineGroupDefinition(
  group: ActivityGroup
): Promise<GroupDefinitionVersion> {
  const existing = await getLatestGroupDefinitionVersion(group.id);
  if (existing) return existing;

  const createdLogicalDay = getEffectiveToday(new Date(group.created_at));
  const version = await appendGroupDefinitionVersion({
    group,
    effectiveFrom: createdLogicalDay,
    force: true,
    enqueue: false,
  });
  if (!version) {
    throw new Error("Failed to create baseline group definition version");
  }
  return version;
}

/** Pure helper for tests: pick the version effective on a logical date. */
export function pickDefinitionVersionAsOf<
  T extends {
    effective_from: string;
    recorded_at: string;
    deleted_at: string | null;
  },
>(versions: T[], logicalDate: string): T | null {
  const applicable = versions.filter(
    (v) => !v.deleted_at && v.effective_from <= logicalDate
  );
  if (applicable.length === 0) return null;
  applicable.sort((a, b) => {
    const byEffective = b.effective_from.localeCompare(a.effective_from);
    if (byEffective !== 0) return byEffective;
    return b.recorded_at.localeCompare(a.recorded_at);
  });
  return applicable[0] ?? null;
}

export function activityLikeFromDefinition(
  version: ActivityDefinitionVersion
): Pick<
  Activity,
  | "id"
  | "name"
  | "routine"
  | "created_at"
  | "completion_target"
  | "group_id"
  | "order_index"
> {
  return {
    id: version.activity_id,
    name: version.name,
    routine: version.routine,
    completion_target: version.completion_target,
    group_id: version.group_id,
    order_index: version.order_index,
    // Scheduling before creation uses definition effective_from as the creation day.
    created_at: `${version.effective_from}T12:00:00.000Z`,
  };
}

export function logicalDateFromInstant(instant: Date = new Date()): string {
  return getEffectiveToday(instant);
}

export function calendarDateString(date: Date): string {
  return toDateString(date);
}
