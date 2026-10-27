import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  checkForAppUpdate,
  type AppUpdateCheck,
} from "@/lib/pwa/reload-into-latest-build";
import { syncEngine } from "@/lib/sync";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

type SyncNotice = "synced" | "failed" | null;

/**
 * Manual resync and app-update check. Syncing does not reload the page.
 * An update check reloads only when a newer service worker is waiting.
 */
export function AppRefreshActions({ className }: { className?: string }) {
  const { t } = useTranslation("settings");
  const { isAuthed } = useAuth();
  const online = useOnlineStatus();
  const [syncState, setSyncState] = useState(syncEngine.getState());
  const [syncNotice, setSyncNotice] = useState<SyncNotice>(null);
  const [updatePhase, setUpdatePhase] = useState<
    AppUpdateCheck | "checking" | "idle"
  >("idle");

  useEffect(() => syncEngine.subscribe(setSyncState), []);

  const updateBusy = updatePhase === "checking" || updatePhase === "updating";

  async function handleSync() {
    const before = syncEngine.getState().lastSyncAt;
    setUpdatePhase("idle");
    setSyncNotice(null);
    try {
      await syncEngine.sync();
    } catch {
      setSyncNotice("failed");
      return;
    }
    const after = syncEngine.getState();
    setSyncNotice(
      after.lastError || after.lastSyncAt === before ? "failed" : "synced"
    );
  }

  async function handleUpdate() {
    setSyncNotice(null);
    setUpdatePhase("checking");
    const result = await checkForAppUpdate();
    setUpdatePhase(result);
  }

  const status = statusMessage({
    online,
    authed: isAuthed,
    syncing: syncState.isSyncing,
    syncNotice,
    updatePhase,
    t,
  });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void handleSync()}
          disabled={!isAuthed || !online || syncState.isSyncing || updateBusy}
          aria-busy={syncState.isSyncing}
        >
          {syncState.isSyncing
            ? t("sync.refresh.syncing")
            : t("sync.refresh.syncNow")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void handleUpdate()}
          disabled={!online || updateBusy}
          aria-busy={updateBusy}
        >
          {updatePhase === "checking"
            ? t("sync.refresh.checking")
            : updatePhase === "updating"
              ? t("sync.refresh.updating")
              : t("sync.refresh.checkUpdate")}
        </Button>
      </div>
      {status ? (
        <p
          className="font-mono text-xs tabular-nums text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}

function statusMessage({
  online,
  authed,
  syncing,
  syncNotice,
  updatePhase,
  t,
}: {
  online: boolean;
  authed: boolean;
  syncing: boolean;
  syncNotice: SyncNotice;
  updatePhase: AppUpdateCheck | "checking" | "idle";
  t: (key: string) => string;
}): string | null {
  if (!online) return t("sync.refresh.offline");
  if (syncing) return t("sync.refresh.syncing");
  if (updatePhase === "checking") return t("sync.refresh.checking");
  if (updatePhase === "updating") return t("sync.refresh.updating");
  if (updatePhase === "current") return t("sync.refresh.upToDate");
  if (updatePhase === "failed") return t("sync.refresh.updateFailed");
  if (updatePhase === "unavailable") return t("sync.refresh.unavailable");
  if (syncNotice === "synced") return t("sync.refresh.synced");
  if (syncNotice === "failed") return t("sync.refresh.syncFailed");
  if (!authed) return t("sync.refresh.signedOut");
  return null;
}
