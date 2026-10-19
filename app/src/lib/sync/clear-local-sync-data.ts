import { db } from "@/lib/db";
import { SYNC_TABLES, TABLE_MAP } from "./sync-constants";
import { TEMPORAL_LOCAL_TABLES } from "./op-owned-fields";
import { clearAccountSettings } from "@/lib/account-settings";
import { syncEngine } from "./index";
import { recordBreadcrumb } from "@/lib/breadcrumbs";

/**
 * Wipes all synced Dexie tables, temporal/sync metadata, and resets in-memory
 * sync state. Call on sign-out (after push) and on account switch (before pull).
 * Does NOT touch UI settings, or other non-sync localStorage keys.
 */
export async function clearLocalSyncData(): Promise<void> {
  recordBreadcrumb("local.cleared", {
    caller: new Error().stack?.split("\n")[2]?.trim(),
  });
  await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...SYNC_TABLES.map((t) => (db[TABLE_MAP[t]] as any).clear()),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...TEMPORAL_LOCAL_TABLES.map((t) => (db[t] as any).clear()),
  ]);
  // Account opt-ins belong to the account, so the next one must not inherit them.
  clearAccountSettings();
  syncEngine.resetAfterLocalClear();
}
