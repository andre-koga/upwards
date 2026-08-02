import { db } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveLastServerSyncAt } from "./sync-storage";
import {
  type SyncTable,
  normalizeSyncRow,
  parseTimestamp,
} from "./sync-transformers";
import { EPOCH, SYNC_TABLES, TABLE_MAP } from "./sync-constants";
import {
  OP_OWNED_ACTIVITY_FIELDS,
  OP_OWNED_DAILY_ENTRY_FIELDS,
  OP_OWNED_GROUP_FIELDS,
} from "./op-owned-fields";
import { OPS_MANAGED_SYNC_TABLES } from "./projection-sync";
import { listOpenConflictEntityIds } from "./sync-issues-store";

export interface PullContext {
  supabase: SupabaseClient;
  userId: string;
  /** Server-side timestamp from the previous pull (not client time). Null on first pull. */
  lastServerSyncAt: string | null;
  dirtyIdsByTable: Map<SyncTable, Set<string>>;
  withSuppressedMutationSignals: <T>(operation: () => Promise<T>) => Promise<T>;
  setApplyRemoteFromPull: (value: boolean) => void;
  /**
   * When temporal ops RPCs are live, prefer server authority for op-owned
   * projection fields and protect open conflict entities.
   */
  opsSyncActive?: boolean;
}

function preserveLocalDefinitionFields(
  table: SyncTable,
  remote: Record<string, unknown>,
  local: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!local) return remote;
  const next = { ...remote };
  const keys =
    table === "activities"
      ? OP_OWNED_ACTIVITY_FIELDS
      : table === "activity_groups"
        ? OP_OWNED_GROUP_FIELDS
        : [];
  for (const key of keys) {
    if (key in local) next[key] = local[key];
  }
  return next;
}

/** @returns The server `now()` captured at the start of this pull (saved as next cutoff). */
export async function runPull(ctx: PullContext): Promise<string> {
  const {
    supabase: client,
    userId,
    lastServerSyncAt,
    dirtyIdsByTable,
    opsSyncActive = false,
  } = ctx;

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
  const conflictEntityIds = opsSyncActive
    ? await listOpenConflictEntityIds()
    : new Set<string>();

  await ctx.withSuppressedMutationSignals(async () => {
    for (const table of SYNC_TABLES) {
      if (opsSyncActive && OPS_MANAGED_SYNC_TABLES.includes(table)) {
        continue;
      }

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

      const localRows: Array<Record<string, unknown> | undefined> =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[dexieTable] as any).bulkGet(
          notDirty.map((r) => String((r as { id: string }).id))
        );
      const localById = new Map(
        localRows
          .filter((r): r is Record<string, unknown> => !!r && !!r.id)
          .map((r) => [String(r.id), r])
      );

      const rowsToApply = notDirty.filter((r) => {
        const id = String((r as { id: string }).id);
        const local = localById.get(id);
        if (!local) return true;

        // When ops own daily counts, server projection is authoritative even if
        // local updated_at is newer (local may only have this device's deltas).
        if (opsSyncActive && table === "daily_entries") {
          return true;
        }

        return (
          parseTimestamp((r as { updated_at?: string }).updated_at) >=
          parseTimestamp(local.updated_at as string | undefined)
        );
      });

      if (rowsToApply.length === 0) continue;

      ctx.setApplyRemoteFromPull(true);
      try {
        const prepared = rowsToApply.map((r) => {
          const id = String((r as { id: string }).id);
          let normalized = {
            ...normalizeSyncRow(table, r as Record<string, unknown>),
            synced_at: (r as { updated_at?: string }).updated_at,
          } as Record<string, unknown>;

          if (
            opsSyncActive &&
            conflictEntityIds.has(id) &&
            (table === "activities" || table === "activity_groups")
          ) {
            normalized = preserveLocalDefinitionFields(
              table,
              normalized,
              localById.get(id)
            );
          }

          // Prefer server op-owned daily fields; keep local only if somehow missing.
          if (opsSyncActive && table === "daily_entries") {
            const local = localById.get(id);
            if (local) {
              for (const key of OP_OWNED_DAILY_ENTRY_FIELDS) {
                if (normalized[key] == null && local[key] != null) {
                  normalized[key] = local[key];
                }
              }
            }
          }

          return normalized;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[dexieTable] as any).bulkPut(prepared);
      } finally {
        ctx.setApplyRemoteFromPull(false);
      }
    }
  });

  saveLastServerSyncAt(serverNow);
  return serverNow;
}
