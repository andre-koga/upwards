import { db, newId, now } from "@/lib/db";
import type { JournalEntryRevision, SyncIssue } from "@/lib/db/types";
import { getOrCreateDeviceId } from "@/lib/sync/device-id";
import { differingFields, type ConflictChoice } from "@/lib/sync/field-diff";
import { keepBothFields } from "@/lib/journal/keep-both";
import { applyConflictResolution } from "@/lib/sync/mutate-synced";
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
  /** "backup": the other side is a backup file, not another device. */
  source?: "device" | "backup";
  /** Set for backup conflicts so re-importing the same file adds no second issue. */
  backup_fingerprint?: string;
  resolution?: {
    /** Older issues also carry "keep_both" under its former name, "combine". */
    choice: ConflictChoice | "combine" | "defer";
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

function journalFieldsFromRow(
  row: Record<string, unknown>
): Record<string, unknown> {
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
  return normalizeSyncRow("journal_entries", data as Record<string, unknown>);
}

function journalLabelFromFields(fields: Record<string, unknown>): {
  entryDate: string | null;
  title: string | null;
} {
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

  const { entryDate: localDate, title: localTitle } = journalLabelFromFields(
    local.fields
  );
  const { entryDate: remoteDate, title: remoteTitle } = journalLabelFromFields(
    remote?.fields ?? {}
  );

  return {
    kind: "journal_conflict",
    entity_id: input.entity_id,
    entry_date: localDate ?? remoteDate,
    entity_label: localTitle ?? remoteTitle,
    local,
    remote,
    base: null,
    differing_fields: differingFields(local.fields, remote?.fields ?? null),
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

/**
 * A previous version holding the words and media of one side of the conflict,
 * so choosing the other never ends them (product-scope.md §2.3). Null when that
 * side had nothing worth keeping.
 */
function revisionFromFields(
  entryDate: string,
  fields: Record<string, unknown>,
  at: string
): JournalEntryRevision | null {
  const title = (fields.title as string | null | undefined) ?? null;
  const text = (fields.text_content as string | null | undefined) ?? null;
  const emoji = (fields.day_emoji as string | null | undefined) ?? null;
  const photos = (fields.photo_paths as string[] | null | undefined) ?? null;
  const video = (fields.video_path as string | null | undefined) ?? null;
  const has =
    Boolean(title?.trim()) ||
    Boolean(text?.trim()) ||
    Boolean(emoji?.trim()) ||
    Boolean(video?.trim()) ||
    (photos?.length ?? 0) > 0;
  if (!has) return null;
  return {
    id: newId(),
    entry_date: entryDate,
    title,
    day_emoji: emoji,
    text_content: text,
    photo_paths: photos,
    video_path: video,
    video_thumbnail:
      (fields.video_thumbnail as string | null | undefined) ?? null,
    created_at: at,
    updated_at: at,
    synced_at: null,
  };
}

function markJournalFields(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of JOURNAL_CONFLICT_FIELD_KEYS) {
    if (key in fields) out[key] = fields[key];
  }
  return out;
}

async function markJournalIssueResolved(
  issue: SyncIssue,
  payload: JournalConflictPayload,
  choice: ConflictChoice | "defer",
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

/**
 * Resolve a journal day by keeping this device's version, the other's, or both
 * (product-scope.md §2.10). It is an ordinary edit to the day (a
 * `projection.upsert` made on the other side's revision), and the side that is
 * left out is kept as a previous version, so no choice here is final.
 *
 * "Keep both" joins the two texts, unions photos and places, and is saved as
 * the day; it does not wait for the person to open the editor, because a
 * resolution that leaves the conflict open would be a second dialog to dismiss.
 * The result opens in the editor next (see the review card) to be trimmed.
 */
export async function resolveJournalConflict(
  issue: SyncIssue,
  choice: ConflictChoice
): Promise<void> {
  if (!isJournalConflictPayload(issue.payload)) {
    throw new Error("Conflict issue is missing a journal conflict payload");
  }
  // A second tap, or a second tab, must not write the choice twice.
  if ((await db.syncIssues.get(issue.id))?.status === "resolved") return;

  const payload = await refreshJournalConflictPayload(issue.payload);
  const mine = payload.local.fields;
  const theirs = payload.remote?.fields ?? null;
  if (choice !== "keep_local" && !theirs) {
    throw new Error("The other version is unavailable for this conflict");
  }

  let chosen: Record<string, unknown>;
  if (choice === "keep_local") {
    chosen = mine;
  } else if (choice === "keep_remote") {
    chosen = theirs as Record<string, unknown>;
  } else {
    chosen = keepBothFields(
      mine as Parameters<typeof keepBothFields>[0],
      theirs as Parameters<typeof keepBothFields>[1]
    ) as unknown as Record<string, unknown>;
  }

  const entryDate = payload.entry_date;
  const at = now();
  // The side a single choice leaves out is kept as a previous version. "Keep
  // both" leaves nothing out.
  const leftOut =
    choice === "keep_local" ? theirs : choice === "keep_remote" ? mine : null;
  const revision =
    leftOut && entryDate ? revisionFromFields(entryDate, leftOut, at) : null;

  // A backup's revision was never on the server; the row this device synced is the base.
  const resultingUpdatedAt = await applyConflictResolution({
    entityType: "journal_entry",
    entityId: payload.entity_id,
    fields: markJournalFields(chosen),
    baseRevision:
      payload.source === "backup" ? null : (payload.remote?.updated_at ?? null),
    keepAsRevisions: revision ? [revision] : [],
  });

  await markJournalIssueResolved(issue, payload, choice, resultingUpdatedAt);
}

export async function deferJournalConflict(issue: SyncIssue): Promise<void> {
  if (isJournalConflictPayload(issue.payload)) {
    const payload = await refreshJournalConflictPayload(issue.payload);
    await markJournalIssueResolved(issue, payload, "defer", null);
    return;
  }
  await deferSyncIssue(issue.id);
}
