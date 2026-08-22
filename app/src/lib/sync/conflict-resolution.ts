import { db, now } from "@/lib/db";
import type {
  ActivityDefinitionVersion,
  GroupDefinitionVersion,
  SyncIssue,
} from "@/lib/db/types";
import {
  appendActivityDefinitionVersion,
  appendGroupDefinitionVersion,
  getLatestActivityDefinitionVersion,
  getLatestGroupDefinitionVersion,
} from "@/lib/activity/definition-versions";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import { deferSyncIssue } from "@/lib/sync/sync-issues-store";

export type DefinitionConflictEntityType =
  "activity_definition" | "group_definition";

export interface ConflictVersionSnapshot {
  version_id: string | null;
  parent_version_id: string | null;
  device_id: string | null;
  effective_from: string | null;
  fields: Record<string, unknown>;
}

export interface DefinitionConflictPayload {
  kind: "definition_conflict";
  entity_type: DefinitionConflictEntityType;
  entity_id: string;
  entity_label: string | null;
  local: ConflictVersionSnapshot;
  remote: ConflictVersionSnapshot | null;
  base: ConflictVersionSnapshot | null;
  differing_fields: string[];
  auto_combinable_fields: string[];
  both_changed_fields: string[];
  resolution?: {
    choice: "keep_local" | "keep_remote" | "combine" | "defer";
    resolved_at: string;
    resulting_version_id?: string | null;
  };
}

export function isDefinitionConflictPayload(
  value: unknown
): value is DefinitionConflictPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as DefinitionConflictPayload).kind === "definition_conflict"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function snapshotFromVersion(
  version: ActivityDefinitionVersion | GroupDefinitionVersion | null
): ConflictVersionSnapshot | null {
  if (!version) return null;
  if ("activity_id" in version) {
    return {
      version_id: version.id,
      parent_version_id: version.parent_version_id,
      device_id: version.device_id,
      effective_from: version.effective_from,
      fields: {
        name: version.name,
        routine: version.routine,
        completion_target: version.completion_target,
        group_id: version.group_id,
        order_index: version.order_index,
      },
    };
  }
  return {
    version_id: version.id,
    parent_version_id: version.parent_version_id,
    device_id: version.device_id,
    effective_from: version.effective_from,
    fields: {
      name: version.name,
      color: version.color,
      order_index: version.order_index,
    },
  };
}

function snapshotFromOpPayload(
  payload: unknown,
  deviceId: string | null
): ConflictVersionSnapshot {
  const p = asRecord(payload);
  const fields = asRecord(p.fields);
  return {
    version_id: typeof p.version_id === "string" ? p.version_id : null,
    parent_version_id:
      typeof p.parent_version_id === "string" ? p.parent_version_id : null,
    device_id: deviceId,
    effective_from:
      typeof p.effective_from === "string" ? p.effective_from : null,
    fields,
  };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return true;
  return String(a ?? "") === String(b ?? "");
}

export interface FieldDiffAnalysis {
  differing_fields: string[];
  auto_combinable_fields: string[];
  both_changed_fields: string[];
}

/** Compare local vs remote fields relative to an optional common ancestor. */
export function analyzeDefinitionFieldDiffs(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown> | null,
  baseFields: Record<string, unknown> | null
): FieldDiffAnalysis {
  const keys = new Set([
    ...Object.keys(localFields),
    ...Object.keys(remoteFields ?? {}),
    ...Object.keys(baseFields ?? {}),
  ]);

  const differing_fields: string[] = [];
  const auto_combinable_fields: string[] = [];
  const both_changed_fields: string[] = [];

  for (const key of [...keys].sort()) {
    const localVal = localFields[key];
    const remoteVal = remoteFields?.[key];
    const baseVal = baseFields?.[key];

    if (remoteFields == null) {
      if (baseFields != null && !valuesEqual(localVal, baseVal)) {
        differing_fields.push(key);
        auto_combinable_fields.push(key);
      } else if (baseFields == null && localVal !== undefined) {
        differing_fields.push(key);
      }
      continue;
    }

    if (valuesEqual(localVal, remoteVal)) continue;
    differing_fields.push(key);

    const localChanged =
      baseFields != null ? !valuesEqual(localVal, baseVal) : true;
    const remoteChanged =
      baseFields != null ? !valuesEqual(remoteVal, baseVal) : true;

    if (localChanged && remoteChanged) {
      both_changed_fields.push(key);
    } else {
      auto_combinable_fields.push(key);
    }
  }

  return { differing_fields, auto_combinable_fields, both_changed_fields };
}

/** Merge fields: one-side change wins; both-changed prefers local by default. */
export function combineDefinitionFields(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown>,
  baseFields: Record<string, unknown> | null,
  options?: { preferLocalOnConflict?: boolean }
): Record<string, unknown> {
  const preferLocal = options?.preferLocalOnConflict !== false;
  const keys = new Set([
    ...Object.keys(localFields),
    ...Object.keys(remoteFields),
    ...Object.keys(baseFields ?? {}),
  ]);
  const result: Record<string, unknown> = {};

  for (const key of keys) {
    const localVal = localFields[key];
    const remoteVal = remoteFields[key];
    const baseVal = baseFields?.[key];

    if (valuesEqual(localVal, remoteVal)) {
      result[key] = localVal;
      continue;
    }

    if (baseFields != null) {
      const localChanged = !valuesEqual(localVal, baseVal);
      const remoteChanged = !valuesEqual(remoteVal, baseVal);
      if (localChanged && !remoteChanged) {
        result[key] = localVal;
        continue;
      }
      if (remoteChanged && !localChanged) {
        result[key] = remoteVal;
        continue;
      }
    }

    result[key] = preferLocal ? localVal : remoteVal;
  }

  return result;
}

async function findAlternateActivitySnapshot(
  activityId: string,
  excludeVersionId: string | null
): Promise<ConflictVersionSnapshot | null> {
  const rows = await db.activityDefinitionVersions
    .where("activity_id")
    .equals(activityId)
    .filter((row) => !row.deleted_at && row.id !== excludeVersionId)
    .toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    const byEffective = b.effective_from.localeCompare(a.effective_from);
    if (byEffective !== 0) return byEffective;
    return b.recorded_at.localeCompare(a.recorded_at);
  });
  return snapshotFromVersion(rows[0] ?? null);
}

async function findAlternateGroupSnapshot(
  groupId: string,
  excludeVersionId: string | null
): Promise<ConflictVersionSnapshot | null> {
  const rows = await db.groupDefinitionVersions
    .where("group_id")
    .equals(groupId)
    .filter((row) => !row.deleted_at && row.id !== excludeVersionId)
    .toArray();
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    const byEffective = b.effective_from.localeCompare(a.effective_from);
    if (byEffective !== 0) return byEffective;
    return b.recorded_at.localeCompare(a.recorded_at);
  });
  return snapshotFromVersion(rows[0] ?? null);
}

export async function buildDefinitionConflictPayload(input: {
  entity_type: DefinitionConflictEntityType;
  entity_id: string;
  /** Your side — pending/local op payload. If omitted, uses the current tip. */
  localPayload?: unknown;
  localDeviceId?: string | null;
  /** Explicit other-device snapshot when already known. */
  remoteSnapshot?: ConflictVersionSnapshot | null;
  /** Other-device op payload (preferred over inferring from local history). */
  remotePayload?: unknown;
  remoteDeviceId?: string | null;
}): Promise<DefinitionConflictPayload> {
  let local: ConflictVersionSnapshot;
  let remote: ConflictVersionSnapshot | null =
    input.remoteSnapshot ??
    (input.remotePayload !== undefined
      ? snapshotFromOpPayload(input.remotePayload, input.remoteDeviceId ?? null)
      : null);
  let base: ConflictVersionSnapshot | null = null;
  let entityLabel: string | null = null;

  if (input.entity_type === "activity_definition") {
    const latest = await getLatestActivityDefinitionVersion(input.entity_id);
    local = input.localPayload
      ? snapshotFromOpPayload(
          input.localPayload,
          input.localDeviceId ?? getOrCreateDeviceId()
        )
      : (snapshotFromVersion(latest) ?? {
          version_id: null,
          parent_version_id: null,
          device_id: getOrCreateDeviceId(),
          effective_from: null,
          fields: {},
        });

    if (!remote) {
      remote = await findAlternateActivitySnapshot(
        input.entity_id,
        local.version_id
      );
      if (!remote && latest && latest.id !== local.version_id) {
        remote = snapshotFromVersion(latest);
      }
    }

    const baseId = local.parent_version_id ?? remote?.parent_version_id ?? null;
    if (baseId) {
      const baseRow = await db.activityDefinitionVersions.get(baseId);
      base = snapshotFromVersion(baseRow ?? null);
    }

    const activity = await db.activities.get(input.entity_id);
    entityLabel =
      (typeof local.fields.name === "string" && local.fields.name) ||
      (typeof remote?.fields.name === "string" && remote.fields.name) ||
      activity?.name ||
      null;
  } else {
    const latest = await getLatestGroupDefinitionVersion(input.entity_id);
    local = input.localPayload
      ? snapshotFromOpPayload(
          input.localPayload,
          input.localDeviceId ?? getOrCreateDeviceId()
        )
      : (snapshotFromVersion(latest) ?? {
          version_id: null,
          parent_version_id: null,
          device_id: getOrCreateDeviceId(),
          effective_from: null,
          fields: {},
        });

    if (!remote) {
      remote = await findAlternateGroupSnapshot(
        input.entity_id,
        local.version_id
      );
      if (!remote && latest && latest.id !== local.version_id) {
        remote = snapshotFromVersion(latest);
      }
    }

    const baseId = local.parent_version_id ?? remote?.parent_version_id ?? null;
    if (baseId) {
      const baseRow = await db.groupDefinitionVersions.get(baseId);
      base = snapshotFromVersion(baseRow ?? null);
    }

    const group = await db.activityGroups.get(input.entity_id);
    entityLabel =
      (typeof local.fields.name === "string" && local.fields.name) ||
      (typeof remote?.fields.name === "string" && remote.fields.name) ||
      group?.name ||
      null;
  }

  const analysis = analyzeDefinitionFieldDiffs(
    local.fields,
    remote?.fields ?? null,
    base?.fields ?? null
  );

  return {
    kind: "definition_conflict",
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    entity_label: entityLabel,
    local,
    remote,
    base,
    differing_fields: analysis.differing_fields,
    auto_combinable_fields: analysis.auto_combinable_fields,
    both_changed_fields: analysis.both_changed_fields,
  };
}

/** Refresh remote/base sides from local history when the stored payload is thin. */
export async function refreshDefinitionConflictPayload(
  payload: DefinitionConflictPayload
): Promise<DefinitionConflictPayload> {
  if (payload.remote && payload.base) return payload;
  return buildDefinitionConflictPayload({
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    localPayload: {
      version_id: payload.local.version_id,
      parent_version_id: payload.local.parent_version_id,
      effective_from: payload.local.effective_from,
      fields: payload.local.fields,
    },
    localDeviceId: payload.local.device_id,
    remoteSnapshot: payload.remote,
  });
}

async function applyResolvedActivityFields(
  entityId: string,
  fields: Record<string, unknown>,
  effectiveFrom: string
): Promise<string> {
  const activity = await db.activities.get(entityId);
  if (!activity) {
    throw new Error("Activity not found for conflict resolution");
  }

  const next = {
    ...activity,
    name:
      fields.name === undefined
        ? activity.name
        : ((fields.name as string | null) ?? null),
    routine:
      fields.routine === undefined
        ? activity.routine
        : ((fields.routine as string | null) ?? null),
    completion_target:
      fields.completion_target === undefined
        ? activity.completion_target
        : ((fields.completion_target as number | null) ?? null),
    group_id:
      typeof fields.group_id === "string" ? fields.group_id : activity.group_id,
    order_index:
      fields.order_index === undefined
        ? activity.order_index
        : ((fields.order_index as number | null) ?? null),
    updated_at: now(),
  };

  await db.activities.update(entityId, {
    name: next.name,
    routine: next.routine,
    completion_target: next.completion_target,
    group_id: next.group_id,
    order_index: next.order_index,
    updated_at: next.updated_at,
  });

  const version = await appendActivityDefinitionVersion({
    activity: next,
    effectiveFrom,
    force: true,
  });

  return version?.id ?? next.id;
}

async function applyResolvedGroupFields(
  entityId: string,
  fields: Record<string, unknown>,
  effectiveFrom: string
): Promise<string> {
  const group = await db.activityGroups.get(entityId);
  if (!group) {
    throw new Error("Group not found for conflict resolution");
  }

  const next = {
    ...group,
    name:
      typeof fields.name === "string" && fields.name.trim()
        ? fields.name
        : group.name,
    color:
      fields.color === undefined
        ? group.color
        : ((fields.color as string | null) ?? null),
    order_index:
      fields.order_index === undefined
        ? group.order_index
        : ((fields.order_index as number | null) ?? null),
    updated_at: now(),
  };

  await db.activityGroups.update(entityId, {
    name: next.name,
    color: next.color,
    order_index: next.order_index,
    updated_at: next.updated_at,
  });

  const version = await appendGroupDefinitionVersion({
    group: next,
    effectiveFrom,
    force: true,
  });

  return version?.id ?? next.id;
}

export type ConflictResolutionChoice = "keep_local" | "keep_remote" | "combine";

export async function resolveDefinitionConflict(
  issue: SyncIssue,
  choice: ConflictResolutionChoice,
  options?: { effectiveFrom?: string }
): Promise<void> {
  if (!isDefinitionConflictPayload(issue.payload)) {
    throw new Error("Conflict issue is missing a definition conflict payload");
  }

  const payload = await refreshDefinitionConflictPayload(issue.payload);
  const effectiveFrom =
    options?.effectiveFrom ??
    payload.local.effective_from ??
    getEffectiveToday();

  const remoteFields = payload.remote?.fields ?? null;
  let chosenFields: Record<string, unknown>;

  if (choice === "keep_local") {
    chosenFields = payload.local.fields;
  } else if (choice === "keep_remote") {
    if (!remoteFields) {
      throw new Error("Remote version is unavailable for this conflict");
    }
    chosenFields = remoteFields;
  } else if (!remoteFields) {
    throw new Error("Remote version is unavailable to combine");
  } else {
    chosenFields = combineDefinitionFields(
      payload.local.fields,
      remoteFields,
      payload.base?.fields ?? null,
      { preferLocalOnConflict: true }
    );
  }

  const resultingVersionId =
    payload.entity_type === "activity_definition"
      ? await applyResolvedActivityFields(
          payload.entity_id,
          chosenFields,
          effectiveFrom
        )
      : await applyResolvedGroupFields(
          payload.entity_id,
          chosenFields,
          effectiveFrom
        );

  await markIssueResolved({ ...issue, payload }, choice, resultingVersionId);
}

async function markIssueResolved(
  issue: SyncIssue,
  choice: ConflictResolutionChoice | "defer",
  resultingVersionId: string | null
): Promise<void> {
  const ts = now();
  const prev = isDefinitionConflictPayload(issue.payload)
    ? issue.payload
    : null;
  const nextPayload = prev
    ? {
        ...prev,
        resolution: {
          choice,
          resolved_at: ts,
          resulting_version_id: resultingVersionId,
        },
      }
    : issue.payload;

  await db.syncIssues.update(issue.id, {
    status: choice === "defer" ? "deferred" : "resolved",
    resolved_at: choice === "defer" ? null : ts,
    updated_at: ts,
    payload: nextPayload,
  });
}

export async function deferDefinitionConflict(issue: SyncIssue): Promise<void> {
  if (isDefinitionConflictPayload(issue.payload)) {
    await markIssueResolved(issue, "defer", null);
    return;
  }
  await deferSyncIssue(issue.id);
}

/** Format a field value for display in the conflict UI. */
export function formatConflictFieldValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}
