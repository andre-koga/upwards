import { syncEngine } from "@/lib/sync";
import { checkLocalDatabase, LONG_SYNC_MS } from "./health";

let started = false;

/** Checks the local database at boot, on return to the app, and during long syncs. */
export function startLocalDatabaseWatch(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  void checkLocalDatabase();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkLocalDatabase();
  });

  let longSyncTimer: ReturnType<typeof setTimeout> | null = null;
  syncEngine.subscribe((state) => {
    if (!state.isSyncing) {
      if (longSyncTimer) clearTimeout(longSyncTimer);
      longSyncTimer = null;
      return;
    }
    if (longSyncTimer) return;
    longSyncTimer = setTimeout(() => {
      longSyncTimer = null;
      if (syncEngine.getState().isSyncing) void checkLocalDatabase();
    }, LONG_SYNC_MS);
  });
}
