import { db } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveLastSyncAt } from "./sync-storage";
import { type SyncTable, parseTimestamp } from "./sync-transformers";
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

      const rowsToApply = data.filter((r) => {
        const id = String((r as { id: string }).id);
        const dirty = dirtyIdsByTable.get(table);
        return !dirty?.has(id);
      });

      if (rowsToApply.length === 0) continue;

      ctx.setApplyRemoteFromPull(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[dexieTable] as any).bulkPut(
          rowsToApply.map((r) => ({ ...r, synced_at: r.updated_at }))
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
