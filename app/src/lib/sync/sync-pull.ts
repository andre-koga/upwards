import { db } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveLastSyncAt } from "./sync-storage";
import {
  type SyncTable,
  normalizeSyncRow,
  parseTimestamp,
} from "./sync-transformers";
import {
  EPOCH,
  FULL_PULL_TABLES,
  PULL_BUFFER_MS,
  SYNC_TABLES,
  TABLE_MAP,
} from "./sync-constants";

export interface PullContext {
  supabase: SupabaseClient;
  userId: string;
  lastSyncAt: string | null;
  dirtyIdsByTable: Map<SyncTable, Set<string>>;
  withSuppressedMutationSignals: <T>(operation: () => Promise<T>) => Promise<T>;
  setApplyRemoteFromPull: (value: boolean) => void;
}

/** @returns ISO timestamp written to storage (for UI `lastSyncAt`). */
export async function runPull(ctx: PullContext): Promise<string> {
  const { supabase: client, userId, lastSyncAt, dirtyIdsByTable } = ctx;
  const fullSince = EPOCH;

  await ctx.withSuppressedMutationSignals(async () => {
    for (const table of SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];
      const shouldFullPull = FULL_PULL_TABLES.includes(table);
      const since = shouldFullPull
        ? fullSince
        : (() => {
            if (!lastSyncAt) return fullSince;
            const sinceMs = Math.max(
              0,
              parseTimestamp(lastSyncAt) - PULL_BUFFER_MS
            );
            return new Date(sinceMs).toISOString();
          })();

      const query = client.from(table).select("*").eq("user_id", userId);

      const { data, error } = await (shouldFullPull
        ? query
        : query.gt("updated_at", since));

      if (error) {
        throw new Error(`Pull error on ${table}: ${error.message}`);
      }

      if (!data || data.length === 0) continue;

      // Skip rows modified during this sync cycle.
      const notDirty = data.filter((r) => {
        const id = String((r as { id: string }).id);
        const dirty = dirtyIdsByTable.get(table);
        return !dirty?.has(id);
      });

      if (notDirty.length === 0) continue;

      // LWW: skip rows where the local version is newer than the remote version.
      // This prevents a failed push from being silently overwritten by the pull.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localRows: Array<{ id: string; updated_at?: string } | undefined> =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[dexieTable] as any).bulkGet(
          notDirty.map((r) => String((r as { id: string }).id))
        );
      const localById = new Map(
        localRows
          .filter((r): r is { id: string; updated_at?: string } => !!r)
          .map((r) => [r.id, r])
      );

      const rowsToApply = notDirty.filter((r) => {
        const local = localById.get(String((r as { id: string }).id));
        if (!local) return true; // new remote row — always apply
        return (
          parseTimestamp(r.updated_at) >= parseTimestamp(local.updated_at)
        );
      });

      if (rowsToApply.length === 0) continue;

      ctx.setApplyRemoteFromPull(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[dexieTable] as any).bulkPut(
          rowsToApply.map((r) => ({
            ...normalizeSyncRow(table, r as Record<string, unknown>),
            synced_at: r.updated_at,
          }))
        );
      } finally {
        ctx.setApplyRemoteFromPull(false);
      }
    }
  });

  const now = new Date().toISOString();
  saveLastSyncAt(now);
  return now;
}
