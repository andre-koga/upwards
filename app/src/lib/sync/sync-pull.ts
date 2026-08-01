import { db } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveLastServerSyncAt } from "./sync-storage";
import {
  type SyncTable,
  normalizeSyncRow,
  parseTimestamp,
} from "./sync-transformers";
import { EPOCH, SYNC_TABLES, TABLE_MAP } from "./sync-constants";

export interface PullContext {
  supabase: SupabaseClient;
  userId: string;
  /** Server-side timestamp from the previous pull (not client time). Null on first pull. */
  lastServerSyncAt: string | null;
  dirtyIdsByTable: Map<SyncTable, Set<string>>;
  withSuppressedMutationSignals: <T>(operation: () => Promise<T>) => Promise<T>;
  setApplyRemoteFromPull: (value: boolean) => void;
}

/** @returns The server `now()` captured at the start of this pull (saved as next cutoff). */
export async function runPull(ctx: PullContext): Promise<string> {
  const { supabase: client, userId, lastServerSyncAt, dirtyIdsByTable } = ctx;

  // Capture server time BEFORE querying so any row written during this pull
  // will have server_updated_at >= serverNow and will be caught next cycle.
  const { data: nowData, error: nowError } = await client.rpc("now");
  if (nowError || !nowData) {
    throw new Error(
      `Failed to fetch server time: ${nowError?.message ?? "no data"}`
    );
  }
  const serverNow: string = nowData;

  const since = lastServerSyncAt ?? EPOCH;

  await ctx.withSuppressedMutationSignals(async () => {
    for (const table of SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];

      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .gt("server_updated_at", since);

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
        return parseTimestamp(r.updated_at) >= parseTimestamp(local.updated_at);
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

  saveLastServerSyncAt(serverNow);
  return serverNow;
}
