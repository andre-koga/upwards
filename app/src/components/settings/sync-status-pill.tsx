import {
  Cloud,
  CloudOff,
  RefreshCw,
  LogIn,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { syncEngine } from "@/lib/sync";

interface SyncStatusPillProps {
  syncState: ReturnType<typeof syncEngine.getState>;
  isOnline: boolean;
  isAuthed: boolean;
  onManualSync: () => void;
  onSignOut: () => void;
  onToggleAuth: () => void;
}

export function SyncStatusPill({
  syncState,
  isOnline,
  isAuthed,
  onManualSync,
  onSignOut,
  onToggleAuth,
}: SyncStatusPillProps) {
  const canSync = isAuthed && isOnline;
  const lastSyncTime = syncState.lastSyncAt
    ? new Date(syncState.lastSyncAt).toLocaleTimeString()
    : "Never";

  return (
    <div className="rounded-full border border-border bg-background shadow-lg">
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={onManualSync}
          disabled={syncState.isSyncing || !canSync}
          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
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

          <span className="text-xs">
            {!isOnline
              ? "Offline"
              : syncState.isSyncing
                ? "Syncing..."
                : syncState.lastError
                  ? "Error"
                  : lastSyncTime}
          </span>
        </button>

        {isAuthed ? (
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={onToggleAuth}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Sign in to sync"
          >
            <LogIn className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
