import { useState, useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { syncEngine } from "@/lib/sync";
import { useAuth } from "@/lib/use-auth";
import { SyncStatusPill } from "./sync-status-pill";
import { AuthPopup } from "./auth-popup";
import { logError } from "@/lib/error-utils";

const FADE_OUT_DELAY_MS = 2200;

export default function SyncStatus() {
  const [syncState, setSyncState] = useState(syncEngine.getState());
  const { isSupabaseConfigured, isAuthed } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isVisible, setIsVisible] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const prevIsSyncingRef = useRef(syncState.isSyncing);

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(setSyncState);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearHideTimer();
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isAuthed) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with auth state */
      setShowAuth(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    const wasSyncing = prevIsSyncingRef.current;

    if (syncState.isSyncing) {
      clearHideTimer();
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with external sync engine */
      setIsVisible(true);
      prevIsSyncingRef.current = true;
      return;
    }

    const justFinished = wasSyncing && !syncState.isSyncing;
    const hasResult = Boolean(syncState.lastSyncAt || syncState.lastError);
    if (justFinished || (syncState.lastError && hasResult)) {
      setIsVisible(true);
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, FADE_OUT_DELAY_MS);
    }

    prevIsSyncingRef.current = syncState.isSyncing;
  }, [syncState.isSyncing, syncState.lastSyncAt, syncState.lastError]);

  const handleManualSync = async () => {
    setIsVisible(true);
    try {
      await syncEngine.sync();
    } catch (error) {
      logError("Manual sync failed", error);
    }
  };

  if (!isSupabaseConfigured) {
    return null;
  }

  return (
    <div
      className={`fixed left-1/2 top-2 z-50 -translate-x-1/2 transition-opacity duration-500 ${
        isVisible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
    >
      <SyncStatusPill
        syncState={syncState}
        isOnline={isOnline}
        isAuthed={isAuthed}
        onManualSync={handleManualSync}
        onToggleAuth={() => setShowAuth((prev) => !prev)}
      />

      {showAuth && !isAuthed && (
        <AuthPopup
          onClose={() => setShowAuth(false)}
          onSignedIn={() => setShowAuth(false)}
        />
      )}

      {isOnline && syncState.lastError && (
        <div className="absolute left-1/2 top-14 w-72 -translate-x-1/2 rounded-lg border border-red-500/50 bg-background p-3 shadow-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="flex-1">
              <p className="mb-1 text-xs font-semibold text-red-500">
                Sync Error
              </p>
              <p className="text-xs text-muted-foreground">
                {syncState.lastError}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
