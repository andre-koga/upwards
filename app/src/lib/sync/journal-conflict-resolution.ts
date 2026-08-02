import { db, now } from "@/lib/db";
import type { JournalEntry, SyncIssue } from "@/lib/db/types";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import {
  analyzeDefinitionFieldDiffs,
  combineDefinitionFields,
  formatConflictFieldValue,
  type ConflictResolutionChoice,
} from "@/lib/sync/conflict-resolution";
import {
  enqueueProjectionUpsertForTable,
  withSuppressedProjectionEnqueue,
} from "@/lib/sync/projection-sync";
import { deferSyncIssue } from "@/lib/sync/sync-issues-store";
import { normalizeSyncRow } from "@/lib/sync/sync-transformers";
import { getCachedUserId, supabase } from "@/lib/supabase";

const JOURNAL_CONFLICT_FIELD_KEYS = [
  "entry_date",
  "title",
  "text_content",
  "day_emoji",
  "is_bookmarked",
  "video_path",
  "video_thumbnail",
  "photo_paths",
  "is_journal_complete",
  "journal_entry_number",
  "journal_completion_streak",
  "journal_completed_at",
  "location",
  "deleted_at",
] as const;

export interface JournalConflictSnapshot {
  device_id: string | null;
  updated_at: string | null;
  base_revision: string | null;
  fields: Record<string, unknown>;
}

export interface JournalConflictPayload {
  kind: "journal_conflict";
  entity_id: string;
  entry_date: string | null;
  entity_label: string | null;
  local: JournalConflictSnapshot;
  remote: JournalConflictSnapshot | null;
  base: JournalConflictSnapshot | null;
  differing_fields: string[];
  auto_combinable_fields: string[];
  both_changed_fields: string[];
  resolution?: {
    choice: ConflictResolutionChoice | "defer";
    resolved_at: string;
    resulting_updated_at?: string | null;
  };
}

export function isJournalConflictPayload(
  value: unknown
): value is JournalConflictPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as JournalConflictPayload).kind === "journal_conflict"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function journalFieldsFromRow(row: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of JOURNAL_CONFLICT_FIELD_KEYS) {
    if (key in row) fields[key] = row[key];
  }
  return fields;
}

function snapshotFromJournalRow(
  row: Record<string, unknown>,
  deviceId: string | null,
  baseRevision?: string | null
): JournalConflictSnapshot {
  return {
    device_id: deviceId,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    base_revision: baseRevision ?? null,
    fields: journalFieldsFromRow(row),
  };
}

async function fetchRemoteJournalEntry(
  entityId: string
): Promise<Record<string, unknown> | null> {
  const userId = getCachedUserId();
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", entityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeSyncRow(
    "journal_entries",
    data as Record<string, unknown>
  );
}

function journalLabelFromFields(
  fields: Record<string, unknown>
): { entryDate: string | null; title: string | null } {
  const entryDate =
    typeof fields.entry_date === "string" ? fields.entry_date : null;
  const title =
    typeof fields.title === "string" && fields.title.trim()
      ? fields.title.trim()
      : null;
  return { entryDate, title };
}

export async function buildJournalConflictPayload(input: {
  entity_id: string;
  /** Your side — pending/local op row. If omitted, uses the local Dexie row. */
  localRow?: unknown;
  localDeviceId?: string | null;
  /** Other-device op row when already known. */
  remoteRow?: unknown;
  remoteDeviceId?: string | null;
  baseRevision?: string | null;
}): Promise<JournalConflictPayload> {
  const localRecord = asRecord(input.localRow);
  const hasLocalRow = Object.keys(localRecord).length > 0;

  let local: JournalConflictSnapshot;
  if (hasLocalRow) {
    const dexieRow = await db.journalEntries.get(input.entity_id);
    const mergedLocal = dexieRow
      ? {
          ...(dexieRow as unknown as Record<string, unknown>),
          ...localRecord,
        }
      : localRecord;
    local = snapshotFromJournalRow(
      mergedLocal,
      input.localDeviceId ?? getOrCreateDeviceId(),
      input.baseRevision ?? null
    );
  } else {
    const dexieRow = await db.journalEntries.get(input.entity_id);
    local = dexieRow
      ? snapshotFromJournalRow(
          dexieRow as unknown as Record<string, unknown>,
          input.localDeviceId ?? getOrCreateDeviceId(),
          input.baseRevision ?? null
        )
      : {
          device_id: input.localDeviceId ?? getOrCreateDeviceId(),
          updated_at: null,
          base_revision: input.baseRevision ?? null,
          fields: {},
        };
  }

  const remoteRecord = asRecord(input.remoteRow);
  let remote: JournalConflictSnapshot | null = null;

  if (Object.keys(remoteRecord).length > 0) {
    remote = snapshotFromJournalRow(remoteRecord, input.remoteDeviceId ?? null);
  } else if (hasLocalRow) {
    const fetched = await fetchRemoteJournalEntry(input.entity_id);
    if (fetched) {
      remote = snapshotFromJournalRow(fetched, null);
    }
  }

  const { entryDate: localDate, title: localTitle } =
    journalLabelFromFields(local.fields);
  const { entryDate: remoteDate, title: remoteTitle } = journalLabelFromFields(
    remote?.fields ?? {}
  );

  const analysis = analyzeDefinitionFieldDiffs(
    local.fields,
    remote?.fields ?? null,
    null
  );

  return {
    kind: "journal_conflict",
    entity_id: input.entity_id,
    entry_date: localDate ?? remoteDate,
    entity_label: localTitle ?? remoteTitle,
    local,
    remote,
    base: null,
    differing_fields: analysis.differing_fields,
    auto_combinable_fields: analysis.auto_combinable_fields,
    both_changed_fields: analysis.both_changed_fields,
  };
}

export async function refreshJournalConflictPayload(
  payload: JournalConflictPayload
): Promise<JournalConflictPayload> {
  if (payload.remote) return payload;
  const dexieRow = await db.journalEntries.get(payload.entity_id);
  const localRow = dexieRow
    ? {
        ...(dexieRow as unknown as Record<string, unknown>),
        ...payload.local.fields,
      }
    : payload.local.fields;
  return buildJournalConflictPayload({
    entity_id: payload.entity_id,
    localRow,
    localDeviceId: payload.local.device_id,
    baseRevision: payload.local.base_revision,
  });
}

function patchJournalFromFields(
  existing: JournalEntry,
  fields: Record<string, unknown>
): JournalEntry {
  const ts = now();
  return {
    ...existing,
    entry_date:
      typeof fields.entry_date === "string"
        ? fields.entry_date
        : existing.entry_date,
    title:
      fields.title !== undefined
        ? (fields.title as string | null)
        : existing.title,
    text_content:
      fields.text_content !== undefined
        ? (fields.text_content as string | null)
        : existing.text_content,
    day_emoji:
      fields.day_emoji !== undefined
        ? (fields.day_emoji as string | null)
        : existing.day_emoji,
    is_bookmarked:
      fields.is_bookmarked !== undefined
        ? (fields.is_bookmarked as boolean | null)
        : existing.is_bookmarked,
    video_path:
      fields.video_path !== undefined
        ? (fields.video_path as string | null)
        : existing.video_path,
    video_thumbnail:
      fields.video_thumbnail !== undefined
        ? (fields.video_thumbnail as string | null)
        : existing.video_thumbnail,
    photo_paths:
      fields.photo_paths !== undefined
        ? (fields.photo_paths as string[] | null)
        : existing.photo_paths,
    is_journal_complete:
      fields.is_journal_complete !== undefined
        ? (fields.is_journal_complete as boolean | null)
        : existing.is_journal_complete,
    journal_entry_number:
      fields.journal_entry_number !== undefined
        ? (fields.journal_entry_number as number | null)
        : existing.journal_entry_number,
    journal_completion_streak:
      fields.journal_completion_streak !== undefined
        ? (fields.journal_completion_streak as number | null)
        : existing.journal_completion_streak,
    journal_completed_at:
      fields.journal_completed_at !== undefined
        ? (fields.journal_completed_at as string | null)
        : existing.journal_completed_at,
    location:
      fields.location !== undefined
        ? (fields.location as JournalEntry["location"])
        : existing.location,
    deleted_at:
      fields.deleted_at !== undefined
        ? (fields.deleted_at as string | null)
        : existing.deleted_at,
    updated_at: ts,
  };
}

async function applyResolvedJournalFields(
  entityId: string,
  fields: Record<string, unknown>,
  remoteUpdatedAt: string | null
): Promise<string> {
  const existing = await db.journalEntries.get(entityId);
  if (!existing) {
    throw new Error("Journal entry not found for conflict resolution");
  }

  const next = patchJournalFromFields(existing, fields);

  await withSuppressedProjectionEnqueue(async () => {
    await db.journalEntries.put(next);
    await enqueueProjectionUpsertForTable(
      "journal_entries",
      next as unknown as Record<string, unknown>,
      remoteUpdatedAt ?? existing.updated_at
    );
  });

  return next.updated_at;
}

async function markJournalIssueResolved(
  issue: SyncIssue,
  payload: JournalConflictPayload,
  choice: ConflictResolutionChoice | "defer",
  resultingUpdatedAt: string | null
): Promise<void> {
  const ts = now();
  const nextPayload: JournalConflictPayload = {
    ...payload,
    resolution: {
      choice,
      resolved_at: ts,
      resulting_updated_at: resultingUpdatedAt,
    },
  };

  await db.syncIssues.update(issue.id, {
    status: choice === "defer" ? "deferred" : "resolved",
    resolved_at: choice === "defer" ? null : ts,
    updated_at: ts,
    payload: nextPayload,
  });
}

export async function resolveJournalConflict(
  issue: SyncIssue,
  choice: ConflictResolutionChoice
): Promise<void> {
  if (!isJournalConflictPayload(issue.payload)) {
    throw new Error("Conflict issue is missing a journal conflict payload");
  }

  const payload = await refreshJournalConflictPayload(issue.payload);
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
      null,
      { preferLocalOnConflict: true }
    );
  }

  const resultingUpdatedAt = await applyResolvedJournalFields(
    payload.entity_id,
    chosenFields,
    payload.remote?.updated_at ?? null
  );

  await markJournalIssueResolved(
    issue,
    payload,
    choice,
    resultingUpdatedAt
  );
}

export async function deferJournalConflict(issue: SyncIssue): Promise<void> {
  if (isJournalConflictPayload(issue.payload)) {
    const payload = await refreshJournalConflictPayload(issue.payload);
    await markJournalIssueResolved(issue, payload, "defer", null);
    return;
  }
  await deferSyncIssue(issue.id);
}

/** Format journal field values for the conflict review table. */
export function formatJournalConflictFieldValue(
  field: string,
  value: unknown
): string {
  if (field === "text_content" && typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    if (trimmed.length <= 120) return trimmed;
    return `${trimmed.slice(0, 117)}…`;
  }
  if (field === "photo_paths" && Array.isArray(value)) {
    if (value.length === 0) return "—";
    return `${value.length} photo${value.length === 1 ? "" : "s"}`;
  }
  if (field === "location" && value && typeof value === "object") {
    const locations = (value as { locations?: unknown[] }).locations;
    if (Array.isArray(locations) && locations.length > 0) {
      return `${locations.length} place${locations.length === 1 ? "" : "s"}`;
    }
  }
  if (field === "is_bookmarked" || field === "is_journal_complete") {
    if (value === true) return "Yes";
    if (value === false) return "No";
  }
  return formatConflictFieldValue(value);
}
