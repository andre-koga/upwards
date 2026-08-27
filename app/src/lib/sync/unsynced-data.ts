import { db } from "@/lib/db";
import { SYNC_TABLES, TABLE_MAP } from "./sync-constants";
import {
  countUnsyncedOperations,
  listUnsyncedOperations,
} from "./pending-operations";

export interface LocalSyncSafetyStatus {
  pendingOpCount: number;
  unsyncedRowCount: number;
  hasUnsyncedData: boolean;
}

/** Rows with local edits not yet marked synced_at on this device. */
async function countUnsyncedRows(): Promise<number> {
  let total = 0;
  for (const table of SYNC_TABLES) {
    const dexieTable = TABLE_MAP[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (db[dexieTable] as any)
      .filter(
        (row: { synced_at?: string | null; updated_at?: string }) =>
          !row.synced_at ||
          (typeof row.updated_at === "string" &&
            row.updated_at > row.synced_at)
      )
      .count();
    total += count;
  }
  return total;
}

/**
 * Whether this device holds data the server does not.
 *
 * The single question every destructive action must ask before wiping local data.
 * `pendingOpCount` deliberately includes `failed` ops: a rejection means the op
 * never reached the server, so its data is *more* at risk than a queued one, not
 * less. Counting only `pending` here is what let a rejected write be destroyed by
 * sign-out while the UI reported a clean sync.
 */
export async function getLocalSyncSafetyStatus(): Promise<LocalSyncSafetyStatus> {
  const [pendingOpCount, unsyncedRowCount] = await Promise.all([
    countUnsyncedOperations(),
    countUnsyncedRows(),
  ]);
  return {
    pendingOpCount,
    unsyncedRowCount,
    hasUnsyncedData: pendingOpCount > 0 || unsyncedRowCount > 0,
  };
}

/**
 * Entity ids with unsynced local work.
 *
 * Used to stop an incoming remote op from overwriting a local edit that has not
 * reached the server yet. `failed` counts as unsynced for the same reason as
 * above: a rejected op's row is unprotected otherwise, so a remote upsert would
 * silently clobber it with no conflict card.
 */
export async function listPendingEntityIds(): Promise<Set<string>> {
  const pending = await listUnsyncedOperations();
  return new Set(
    pending
      .map((row) => row.entity_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}

export async function hasPendingOperationForEntity(
  entityId: string
): Promise<boolean> {
  const pending = await listUnsyncedOperations();
  return pending.some((row) => row.entity_id === entityId);
}
