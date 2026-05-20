import { db } from "@/lib/db";
import { SYNC_TABLES, TABLE_MAP } from "./sync-constants";
import { syncEngine } from "./index";

/**
 * Wipes all synced Dexie tables and resets in-memory sync state.
 * Call this on sign-out (after push) and on account switch (before pull).
 * Does NOT touch palette, UI settings, or other non-sync localStorage keys.
 */
export async function clearLocalSyncData(): Promise<void> {
  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SYNC_TABLES.map((t) => (db[TABLE_MAP[t]] as any).clear())
  );
  syncEngine.resetAfterLocalClear();
}

/**
 * Returns true if any synced table contains at least one non-deleted row.
 * Used to detect whether a guest user has local data before first sign-in.
 */
export async function hasLocalSyncableData(): Promise<boolean> {
  for (const table of SYNC_TABLES) {
    const dexieTable = db[TABLE_MAP[table]];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (dexieTable as any)
      .filter((r: { deleted_at?: string | null }) => !r.deleted_at)
      .count();
    if (count > 0) return true;
  }
  return false;
}
