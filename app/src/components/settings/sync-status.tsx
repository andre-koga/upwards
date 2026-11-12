import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { syncEngine } from "@/lib/sync";
import { useAuth } from "@/lib/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

/** Keeps a very quick sync on screen long enough to register. */
const LINGER_MS = 600;

/**
 * Sync status that stays out of the way. While a sync runs, a hairline sweeps
 * along the top edge. Nothing shows once it's done. Two states stay on screen
 * because they need attention: a muted dot while offline, and a terracotta dot
 * after a failed sync that opens Sync issues. Manual sync lives in Settings.
 */
export default function SyncStatus() {
  const { t } = useTranslation("settings", { keyPrefix: "sync.indicator" });
  const [syncState, setSyncState] = useState(syncEngine.getState());
  const { isSupabaseConfigured } = useAuth();
  const isOnline = useOnlineStatus();
  const [lingering, setLingering] = useState(false);

  useEffect(() => syncEngine.subscribe(setSyncState), []);

  const syncing = syncState.isSyncing;
  useEffect(() => {
    if (syncing) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the external sync engine */
      setLingering(true);
      return;
    }
    const timer = window.setTimeout(() => setLingering(false), LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [syncing]);

  if (!isSupabaseConfigured) return null;

  const showSweep = isOnline && (syncing || lingering);
  const failed = isOnline && !syncing && Boolean(syncState.lastError);

  return (
    <>
      <span role="status" className="sr-only">
        {showSweep ? t("syncing") : ""}
      </span>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-[var(--ios-status-shield,0px)] z-50 h-0.5 overflow-hidden transition-opacity duration-500",
          showSweep ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="sync-sweep h-full w-1/3 rounded-full bg-foreground/30" />
      </div>

      {failed ? (
        <Link
          to="/settings/sync-issues"
          className="fixed left-1 top-[calc(var(--ios-status-shield,0px)+0.25rem)] z-50 flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={t("failed")}
          aria-label={t("failed")}
        >
          <span className="h-2 w-2 rounded-full bg-terracotta" />
        </Link>
      ) : !isOnline ? (
        <span
          role="img"
          className="fixed left-1 top-[calc(var(--ios-status-shield,0px)+0.25rem)] z-50 flex h-6 w-6 items-center justify-center"
          title={t("offline")}
          aria-label={t("offline")}
        >
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
        </span>
      ) : null}
    </>
  );
}
