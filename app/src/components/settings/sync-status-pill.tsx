import { Cloud, CloudOff, RefreshCw, LogIn, AlertCircle } from "lucide-react";
import { syncEngine } from "@/lib/sync";
import { formatSyncTime } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";

interface SyncStatusPillProps {
  syncState: ReturnType<typeof syncEngine.getState>;
  isOnline: boolean;
  isAuthed: boolean;
  onManualSync: () => void;
  onToggleAuth: () => void;
}

export function SyncStatusPill({
  syncState,
  isOnline,
  isAuthed,
  onManualSync,
  onToggleAuth,
}: SyncStatusPillProps) {
  const canSync = isAuthed && isOnline;
  const lastSyncTime = formatSyncTime(syncState.lastSyncAt);

  return (
    <div className="rounded-full border border-border bg-background/95 shadow-sm backdrop-blur-sm">
      <div className="flex h-8 items-center gap-1.5 px-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onManualSync}
          disabled={syncState.isSyncing || !canSync}
          className="h-auto gap-1.5 px-1 py-0 text-xs text-muted-foreground shadow-none hover:text-foreground"
          title={
            !isOnline
              ? "Offline"
              : !isAuthed
                ? "Not signed in"
                : syncState.isSyncing
                  ? "Syncing..."
                  : "Click to sync now"
          }
        >
          {!isOnline ? (
            <CloudOff className="h-3.5 w-3.5" />
          ) : canSync ? (
            syncState.isSyncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : syncState.lastError ? (
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Cloud className="h-3.5 w-3.5 text-green-500" />
            )
          ) : (
            <CloudOff className="h-3.5 w-3.5" />
          )}

          <span className="mt-0.5 text-xs">
            {!isOnline
              ? "Offline"
              : syncState.isSyncing
                ? "Syncing..."
                : syncState.lastError
                  ? "Error"
                  : lastSyncTime}
          </span>
        </Button>

        {!isAuthed && (
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleAuth}
            className="h-auto gap-1 px-1 py-0 text-xs text-muted-foreground shadow-none hover:text-foreground"
            title="Sign in to sync"
          >
            <LogIn className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
