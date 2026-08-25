import { db } from "@/lib/db";
import { SYNC_TABLES, TABLE_MAP } from "./sync-constants";
import {
  countPendingOperations,
  listPendingOperations,
} from "./pending-operations";

export interface LocalSyncSafetyStatus {
  pendingOpCount: number;
  unsyncedRowCount: number;
  hasUnsyncedData: boolean;
}

/** Rows with local edits not yet marked synced_at on this device. */
export async function countUnsyncedRows(): Promise<number> {
  let total = 0;
  for (const table of SYNC_TABLES) {
    const dexieTable = TABLE_MAP[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (db[dexieTable] as any)
      .filter(
        (row: { synced_at?: string | null; updated_at?: string }) =>
          !row.synced_at || row.updated_at > row.synced_at
      )
      .count();
    total += count;
  }
  return total;
}

export async function getLocalSyncSafetyStatus(): Promise<LocalSyncSafetyStatus> {
  const [pendingOpCount, unsyncedRowCount] = await Promise.all([
    countPendingOperations({ status: "pending" }),
    countUnsyncedRows(),
  ]);
  return {
    pendingOpCount,
    unsyncedRowCount,
    hasUnsyncedData: pendingOpCount > 0 || unsyncedRowCount > 0,
  };
}

export async function listPendingEntityIds(): Promise<Set<string>> {
  const pending = await listPendingOperations({ status: "pending" });
  return new Set(
    pending
      .map((row) => row.entity_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}

export async function hasPendingOperationForEntity(
  entityId: string
): Promise<boolean> {
  const pending = await listPendingOperations({ status: "pending" });
  return pending.some((row) => row.entity_id === entityId);
}
