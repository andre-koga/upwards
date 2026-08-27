import { db } from "@/lib/db";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { normalizeSyncRow, type SyncTable } from "./sync-transformers";
import { TABLE_MAP } from "./sync-constants";
import { withSuppressedProjectionEnqueue } from "./projection-sync";
import { isSyncOperationsRpcMissing } from "./sync-operations";
import { saveOpsRpcAvailable } from "./sync-storage";
import { stripOpOwnedFields } from "./op-owned-fields";
import { isUntimedPeriod } from "@/lib/activity/untimed-period";

const SNAPSHOT_TABLES: SyncTable[] = [
  "activity_groups",
  "activities",
  "daily_entries",
  "activity_periods",
  "journal_entries",
  "one_time_tasks",
  "recurring_memos",
  "activity_status_events",
  "group_status_events",
];

export interface SyncSnapshot {
  server_sequence: number;
  activity_groups?: Record<string, unknown>[];
  activities?: Record<string, unknown>[];
  daily_entries?: Record<string, unknown>[];
  activity_periods?: Record<string, unknown>[];
  journal_entries?: Record<string, unknown>[];
  one_time_tasks?: Record<string, unknown>[];
  recurring_memos?: Record<string, unknown>[];
  activity_status_events?: Record<string, unknown>[];
  group_status_events?: Record<string, unknown>[];
}

export interface PullSnapshotResult {
  skipped?: boolean;
  sequence?: number;
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
    case "one_time_tasks":
      return snapshot.one_time_tasks ?? [];
    case "recurring_memos":
      return snapshot.recurring_memos ?? [];
    case "activity_status_events":
      return snapshot.activity_status_events ?? [];
    case "group_status_events":
      return snapshot.group_status_events ?? [];
    default:
      return [];
  }
}

export async function applySyncSnapshot(snapshot: SyncSnapshot): Promise<void> {
  const userId = getCachedUserId();
  if (!userId) return;

  await withSuppressedProjectionEnqueue(async () => {
    for (const table of SNAPSHOT_TABLES) {
      const dexieKey = TABLE_MAP[table];
      const incoming = snapshotRows(snapshot, table)
        .map((row): Record<string, unknown> => ({
          ...normalizeSyncRow(table, row),
          synced_at:
            typeof row.updated_at === "string" ? row.updated_at : null,
        }))
        .filter((row) => {
          if (table !== "activity_periods") return true;
          const start =
            typeof row.start_time === "string" ? row.start_time : "";
          const end = typeof row.end_time === "string" ? row.end_time : null;
          return !isUntimedPeriod(start, end);
        });

      if (incoming.length === 0) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localTable = db[dexieKey] as any;
      const existing: Array<Record<string, unknown>> =
        await localTable.toArray();
      const existingById = new Map(
        existing
          .filter((row): row is Record<string, unknown> & { id: string } =>
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
        return { ...local, ...stripOpOwnedFields(table, row) };
      });

      await localTable.bulkPut(merged);
    }
  });
}

export async function pullAndApplySnapshot(): Promise<PullSnapshotResult> {
  if (!supabase) return { skipped: true };
  if (!getCachedUserId()) return { skipped: true };

  const { data, error } = await supabase.rpc("pull_sync_snapshot");
  if (error) {
    if (isSyncOperationsRpcMissing(error)) {
      saveOpsRpcAvailable(false);
      return { skipped: true };
    }
    throw new Error(`pull_sync_snapshot failed: ${error.message}`);
  }

  saveOpsRpcAvailable(true);
  const snapshot = (data ?? {}) as SyncSnapshot;
  const sequence =
    typeof snapshot.server_sequence === "number"
      ? snapshot.server_sequence
      : Number(snapshot.server_sequence ?? 0);
  await applySyncSnapshot({
    ...snapshot,
    server_sequence: Number.isFinite(sequence) ? sequence : 0,
  });
  return { sequence: Number.isFinite(sequence) ? sequence : 0 };
}
