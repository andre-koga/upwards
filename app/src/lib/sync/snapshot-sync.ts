import { db } from "@/lib/db";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { withoutDroppedColumns } from "@/lib/db/legacy-shapes";
import { normalizeSyncRow, type SyncTable } from "./sync-transformers";
import { CLIENT_PROTOCOL, TABLE_MAP } from "./sync-constants";
import { withSuppressedProjectionEnqueue } from "./projection-sync";
import { isSyncOperationsRpcMissing } from "./sync-operations";
import { saveOpsRpcAvailable } from "./sync-storage";
import { stripOpOwnedFields } from "./op-owned-fields";
import { listUnsyncedOperations } from "./pending-operations";
import { listOpenConflictEntityIds } from "./sync-issues-store";
import {
  readDataEpoch,
  recordObservedDataEpoch,
  throwIfClientOutdated,
} from "./release-gate";

const SNAPSHOT_TABLES: SyncTable[] = [
  "activity_groups",
  "activities",
  "daily_entries",
  "activity_periods",
  "journal_entries",
  "journal_entry_revisions",
  "memories",
  "one_time_tasks",
];

export interface SyncSnapshot {
  server_sequence: number;
  activity_groups?: Record<string, unknown>[];
  activities?: Record<string, unknown>[];
  daily_entries?: Record<string, unknown>[];
  activity_periods?: Record<string, unknown>[];
  journal_entries?: Record<string, unknown>[];
  journal_entry_revisions?: Record<string, unknown>[];
  memories?: Record<string, unknown>[];
  one_time_tasks?: Record<string, unknown>[];
}

export interface PullSnapshotResult {
  skipped?: boolean;
  sequence?: number;
  /** The data epoch this snapshot was read under. */
  dataEpoch?: number;
}

function snapshotRows(
  snapshot: SyncSnapshot,
  table: SyncTable
): Record<string, unknown>[] {
  switch (table) {
    case "activity_groups":
      return snapshot.activity_groups ?? [];
    case "activities":
      return snapshot.activities ?? [];
    case "daily_entries":
      return snapshot.daily_entries ?? [];
    case "activity_periods":
      return snapshot.activity_periods ?? [];
    case "journal_entries":
      return snapshot.journal_entries ?? [];
    case "journal_entry_revisions":
      return snapshot.journal_entry_revisions ?? [];
    case "memories":
      return snapshot.memories ?? [];
    case "one_time_tasks":
      return snapshot.one_time_tasks ?? [];
    default:
      return [];
  }
}

/**
 * Whether a local row holds content an incoming tombstone must not destroy.
 *
 * Restricted to `journal_entries` on purpose. The app has no user-facing journal
 * delete — grepped for it — so every journal tombstone is machine-written by the
 * dedupe or cutover paths, and production holds 54 of them, 53 carrying text. An
 * incoming journal tombstone therefore never represents a user's intent to delete,
 * which makes refusing it safe.
 *
 * activity_periods is deliberately excluded even though a period note is also
 * free text: use-session-details.ts:260 lets the user delete a session, note and
 * all, so refusing that tombstone would resurrect a row they meant to remove.
 */
function localRowHasContent(
  table: SyncTable,
  local: Record<string, unknown>
): boolean {
  if (table !== "journal_entries") return false;

  const text = (value: unknown): boolean =>
    typeof value === "string" && value.trim().length > 0;

  return (
    text(local.text_content) ||
    text(local.title) ||
    text(local.day_emoji) ||
    text(local.video_path) ||
    (Array.isArray(local.photo_paths) && local.photo_paths.length > 0)
  );
}

/** Tables with one row per (user, date) on the server. */
const DATE_KEYED_TABLES: Partial<Record<SyncTable, "date" | "entry_date">> = {
  daily_entries: "date",
  journal_entries: "entry_date",
};

/**
 * Local rows the server holds under another id.
 *
 * The server keeps one journal row and one daily row per (user, date),
 * tombstones included, and the A8b window re-keyed the old ones to the id every
 * device derives. So when the snapshot has a row for a date under a different
 * id, a local row for that date no longer exists on the server: it is a stale
 * copy, and the snapshot just delivered the real one.
 *
 * Only a copy is retired: the local row must be synced, with no queued op and no
 * open conflict card. Anything else might hold work the server never got, so it
 * stays (journalEntryForDate reads the natural row first meanwhile) until a later
 * snapshot, after the push, can prove it redundant.
 */
async function retireSupersededLocalRows(
  table: SyncTable,
  dateField: "date" | "entry_date",
  incoming: Array<Record<string, unknown>>,
  existing: Array<Record<string, unknown>>
): Promise<void> {
  const serverIdByDate = new Map<string, string>();
  for (const row of incoming) {
    const date = row[dateField];
    if (typeof date === "string" && typeof row.id === "string") {
      serverIdByDate.set(date, row.id);
    }
  }

  const stale = existing.filter((row) => {
    const date = row[dateField];
    if (typeof date !== "string" || typeof row.id !== "string") return false;
    const serverId = serverIdByDate.get(date);
    return serverId !== undefined && serverId !== row.id;
  });
  if (stale.length === 0) return;

  const [pending, conflicts] = await Promise.all([
    listUnsyncedOperations(),
    listOpenConflictEntityIds(),
  ]);
  const busy = new Set(
    pending.map((op) => op.entity_id).filter((id): id is string => !!id)
  );
  const ids = stale
    .filter((row) => {
      const id = row.id as string;
      const syncedAt = typeof row.synced_at === "string" ? row.synced_at : null;
      const updatedAt =
        typeof row.updated_at === "string" ? row.updated_at : "";
      return (
        syncedAt !== null &&
        updatedAt <= syncedAt &&
        !busy.has(id) &&
        !conflicts.has(id)
      );
    })
    .map((row) => row.id as string);
  if (ids.length === 0) return;

  if (table === "journal_entries") {
    await db.journalEntries.bulkDelete(ids);
  } else {
    await db.dailyEntries.bulkDelete(ids);
  }
}

export async function applySyncSnapshot(snapshot: SyncSnapshot): Promise<void> {
  const userId = getCachedUserId();
  if (!userId) return;

  await withSuppressedProjectionEnqueue(async () => {
    for (const table of SNAPSHOT_TABLES) {
      const dexieKey = TABLE_MAP[table];
      const incoming = snapshotRows(snapshot, table).map(
        (row): Record<string, unknown> => ({
          ...normalizeSyncRow(table, row),
          synced_at: typeof row.updated_at === "string" ? row.updated_at : null,
        })
      );
      if (incoming.length === 0) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localTable = db[dexieKey] as any;
      const existing: Array<Record<string, unknown>> =
        await localTable.toArray();
      const existingById = new Map(
        existing
          .filter(
            (row): row is Record<string, unknown> & { id: string } =>
              typeof row.id === "string"
          )
          .map((row) => [row.id, row])
      );

      // A snapshot is a repair pass, not a source of truth for deletion.
      // Rows the server has not seen may simply be unpushed local work, and the
      // pending-op gate cannot prove otherwise: an op the server rejected is
      // marked `failed`, not `pending`. Merge forward only.
      const merged = incoming.map((row) => {
        const local =
          typeof row.id === "string" ? existingById.get(row.id) : undefined;
        if (!local) return row;
        // Counts, pauses, and break days belong to the semantic op stream.
        // Overwriting them here silently discards local completions.
        // Drop columns the server no longer has, so the re-bootstrap after the
        // A8b window also cleans the local copy.
        const next = withoutDroppedColumns(table, {
          ...local,
          ...stripOpOwnedFields(table, row),
        });

        // Symmetry with the rule above. The merge lets incoming fields win, so an
        // incoming tombstone would delete a live local row — including one whose
        // content has never been pushed, which is exactly the row a snapshot repair
        // pass is least entitled to destroy. Production holds 54 journal tombstones
        // (53 with text) that could arrive this way.
        //
        // Keeps the whole local row, not just `deleted_at`: a tombstoned server row
        // usually has its content fields blanked too, so merging those in would
        // leave an undeleted but empty row — the same loss by another route.
        if (
          row.deleted_at &&
          !local.deleted_at &&
          localRowHasContent(table, local)
        ) {
          return local;
        }

        return next;
      });

      await localTable.bulkPut(merged);

      const dateField = DATE_KEYED_TABLES[table];
      if (dateField) {
        await retireSupersededLocalRows(table, dateField, incoming, existing);
      }
    }
  });
}

export async function pullAndApplySnapshot(): Promise<PullSnapshotResult> {
  if (!supabase) return { skipped: true };
  if (!getCachedUserId()) return { skipped: true };

  const { data, error } = await supabase.rpc("pull_sync_snapshot", {
    p_client_protocol: CLIENT_PROTOCOL,
  });
  if (error) {
    throwIfClientOutdated(error);
    if (isSyncOperationsRpcMissing(error)) {
      saveOpsRpcAvailable(false);
      return { skipped: true };
    }
    throw new Error(`pull_sync_snapshot failed: ${error.message}`);
  }

  saveOpsRpcAvailable(true);
  const dataEpoch = readDataEpoch(data);
  recordObservedDataEpoch(dataEpoch);
  const snapshot = (data ?? {}) as SyncSnapshot;
  const sequence =
    typeof snapshot.server_sequence === "number"
      ? snapshot.server_sequence
      : Number(snapshot.server_sequence ?? 0);
  await applySyncSnapshot({
    ...snapshot,
    server_sequence: Number.isFinite(sequence) ? sequence : 0,
  });
  return {
    sequence: Number.isFinite(sequence) ? sequence : 0,
    ...(dataEpoch != null ? { dataEpoch } : {}),
  };
}
