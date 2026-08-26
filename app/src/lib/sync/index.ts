import {
  supabase,
  getCachedUserId,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  getErrorMessage,
  logError,
  ERROR_MESSAGES,
  isTransientNetworkError,
} from "@/lib/error-utils";
import {
  loadLastServerSyncAt,
  clearLastServerSyncAt,
  loadLastAppliedSequence,
  advanceLastAppliedSequence,
  loadSyncProtocolV2,
  saveSyncProtocolV2,
  saveLastServerSyncAt,
  clearSyncProtocolV2,
} from "./sync-storage";
import {
  DEBOUNCE_SYNC_MS,
  REMOTE_DEBOUNCE_SYNC_MS,
  DEFAULT_PERIODIC_SYNC_MS,
  MAX_CHAINED_SYNCS,
} from "./sync-constants";
import {
  pushPendingOperations,
  pullAndApplyOperations,
} from "./sync-operations";
import { recordSyncIssue, resolveOpenSyncErrors } from "./sync-issues-store";
import { touchLocalDevice } from "./device-id";
import { countPendingOperations } from "./pending-operations";
import {
  subscribeToRemoteSyncOperations,
  unsubscribeFromRemoteSyncOperations,
} from "./realtime-sync";
import { syncDeviceRegistry } from "./remote-device-sync";
import { registerSyncScheduler, clearSyncScheduler } from "./sync-scheduler";
import {
  enqueueUnsyncedCurrentStateRows,
  repairNaturalIdentity,
} from "./identity-repair";
import { pullAndApplySnapshot } from "./snapshot-sync";

export interface PushBeforeSignOutResult {
  success: boolean;
  pendingCount: number;
  unsyncedRowCount: number;
  pushFailed: boolean;
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Incremented each time local data is wiped; subscribers can reload on change. */
  localDataVersion: number;
}

type StateListener = (state: SyncState) => void;

class SyncEngine {
  private state: SyncState = {
    isSyncing: false,
    lastSyncAt: loadLastServerSyncAt(),
    lastError: null,
    localDataVersion: 0,
  };
  private listeners = new Set<StateListener>();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private pageShowHandler: (() => void) | null = null;
  private realtimeUnsubscribe: (() => void) | null = null;
  private periodicIntervalMs = DEFAULT_PERIODIC_SYNC_MS;
  private isAutoSyncEnabled = false;
  private pendingResync = false;
  private followUpSyncChain = 0;
  private lastTriggeredSyncMs = 0;
  private static readonly FOCUS_SYNC_THROTTLE_MS = 60_000;

  getState(): SyncState {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<SyncState>): void {
    if (patch.lastError && typeof patch.lastError === "string") {
      if (!isTransientNetworkError(patch.lastError)) {
        void recordSyncIssue({
          kind: "error",
          title: "Sync error",
          detail: patch.lastError,
          account_id: getCachedUserId(),
        });
      }
    }
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private runTriggeredSync(): void {
    this.clearDebounceTimer();
    this.resetPeriodicInterval();
    this.lastTriggeredSyncMs = Date.now();
    void this.sync();
  }

  private runThrottledSync(): void {
    const elapsed = Date.now() - this.lastTriggeredSyncMs;
    if (elapsed < SyncEngine.FOCUS_SYNC_THROTTLE_MS) return;
    this.runTriggeredSync();
  }

  scheduleDebouncedSync(): void {
    this.scheduleDebouncedSyncIn(DEBOUNCE_SYNC_MS);
  }

  private scheduleRemoteDebouncedSync(): void {
    this.scheduleDebouncedSyncIn(REMOTE_DEBOUNCE_SYNC_MS);
  }

  private scheduleDebouncedSyncIn(delayMs: number): void {
    if (!this.isAutoSyncEnabled) return;

    this.clearDebounceTimer();

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.runTriggeredSync();
    }, delayMs);
  }

  private resetPeriodicInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (!this.isAutoSyncEnabled) return;

    this.syncInterval = setInterval(
      () => this.runTriggeredSync(),
      this.periodicIntervalMs
    );
  }

  private canSync(): boolean {
    if (!isSupabaseConfigured || !supabase) return false;
    if (!getCachedUserId()) return false;
    return true;
  }

  async push(): Promise<{ failedTables: string[] }> {
    if (!this.canSync()) return { failedTables: [] };
    const result = await pushPendingOperations();
    return { failedTables: result.failed ? ["sync_operations"] : [] };
  }

  async pull(): Promise<void> {
    if (!this.canSync()) return;
    const pullOpsResult = await pullAndApplyOperations(
      loadLastAppliedSequence()
    );
    if (pullOpsResult.skipped !== true && pullOpsResult.maxSequence != null) {
      advanceLastAppliedSequence(pullOpsResult.maxSequence);
    }
    const userId = getCachedUserId();
    if (userId) {
      void touchLocalDevice(userId);
      void syncDeviceRegistry(userId);
    }
  }

  private async bootstrapProtocolV2(): Promise<boolean> {
    if (loadSyncProtocolV2()) return true;
    await repairNaturalIdentity();
    await enqueueUnsyncedCurrentStateRows();
    const pushResult = await pushPendingOperations();
    if (pushResult.skipped) return false;
    if (pushResult.failed) return false;
    const pending = await countPendingOperations({ status: "pending" });
    if (pending > 0) return false;
    const snapshot = await pullAndApplySnapshot();
    if (snapshot.skipped) return false;
    if (snapshot.sequence != null) {
      advanceLastAppliedSequence(snapshot.sequence);
    }
    saveSyncProtocolV2();
    saveLastServerSyncAt(new Date().toISOString());
    this.setState({ lastSyncAt: new Date().toISOString() });
    return true;
  }

  async sync(): Promise<void> {
    if (!this.canSync()) return;
    if (this.state.isSyncing) {
      this.pendingResync = true;
      return;
    }

    this.setState({ isSyncing: true, lastError: null });
    let interruptedTransiently = false;
    try {
      const alreadyV2 = loadSyncProtocolV2();
      const bootstrapped = await this.bootstrapProtocolV2();
      const pushOpsResult = await pushPendingOperations();
      if (pushOpsResult.skipped === true) {
        const msg =
          "Cloud sync is unavailable. Update the app or try again later.";
        logError("Sync ops RPC missing", new Error(msg));
        this.setState({ lastError: msg });
        return;
      }

      if (pushOpsResult.failed && pushOpsResult.transient) {
        interruptedTransiently = true;
      } else if (pushOpsResult.failed) {
        const msg =
          "Some pending changes could not be uploaded. Try syncing again.";
        logError("Sync ops push failed", new Error(msg));
        this.setState({ lastError: msg });
      }

      const shouldPullIncrementally = alreadyV2 || !bootstrapped;
      if (shouldPullIncrementally) {
        const pullOpsResult = await pullAndApplyOperations(
          loadLastAppliedSequence()
        );
        if (pullOpsResult.skipped === true) {
          const msg =
            "Cloud sync is unavailable. Update the app or try again later.";
          logError("Sync ops RPC missing", new Error(msg));
          this.setState({ lastError: msg });
          return;
        }
        if (pullOpsResult.maxSequence != null) {
          advanceLastAppliedSequence(pullOpsResult.maxSequence);
        }
      }

      const userId = getCachedUserId();
      if (userId) {
        void touchLocalDevice(userId);
        void syncDeviceRegistry(userId);
      }
      this.setState({ lastSyncAt: new Date().toISOString() });
      saveLastServerSyncAt(this.state.lastSyncAt ?? new Date().toISOString());
      if (!bootstrapped && !loadSyncProtocolV2()) {
        this.pendingResync = true;
      }
    } catch (err) {
      if (isTransientNetworkError(err)) {
        interruptedTransiently = true;
        console.warn("[sync] interrupted (transient):", err);
      } else {
        const msg = getErrorMessage(err, ERROR_MESSAGES.SYNC);
        logError("Sync failed", err);
        this.setState({ lastError: msg });
      }
    } finally {
      this.setState({ isSyncing: false });

      const cleanSync =
        !this.state.lastError && !interruptedTransiently && this.canSync();
      if (cleanSync) {
        try {
          await resolveOpenSyncErrors();
        } catch (cleanupErr) {
          console.warn("[sync] post-sync cleanup failed:", cleanupErr);
        }
      }

      const needsAnother = this.pendingResync;
      this.pendingResync = false;

      if (needsAnother && this.canSync()) {
        this.followUpSyncChain += 1;
        if (this.followUpSyncChain > MAX_CHAINED_SYNCS) {
          console.warn(
            "[sync] stopped follow-up sync chain: max depth reached"
          );
          this.followUpSyncChain = 0;
        } else {
          void this.sync();
        }
      } else {
        this.followUpSyncChain = 0;
      }
    }
  }

  async pushBeforeSignOut(): Promise<PushBeforeSignOutResult> {
    let pushFailed = false;
    try {
      const pushOpsResult = await pushPendingOperations();
      if (pushOpsResult.failed || pushOpsResult.skipped) {
        pushFailed = true;
      }
    } catch (err) {
      pushFailed = true;
      console.warn("[sync] pushBeforeSignOut failed:", err);
    }

    const pendingCount = await countPendingOperations({ status: "pending" });

    return {
      success: !pushFailed && pendingCount === 0,
      pendingCount,
      unsyncedRowCount: pendingCount,
      pushFailed,
    };
  }

  resetAfterLocalClear(): void {
    this.pendingResync = false;
    this.followUpSyncChain = 0;
    clearLastServerSyncAt();
    clearSyncProtocolV2();
    localStorage.removeItem("okhabit_natural_identity_repaired_v1");
    this.setState({
      lastSyncAt: null,
      lastError: null,
      localDataVersion: this.state.localDataVersion + 1,
    });
  }

  startAutoSync(
    intervalMs = DEFAULT_PERIODIC_SYNC_MS,
    userId?: string | null
  ): void {
    this.stopAutoSync();

    this.isAutoSyncEnabled = true;
    this.periodicIntervalMs = intervalMs;
    registerSyncScheduler(() => this.scheduleDebouncedSync());

    void this.sync();

    this.resetPeriodicInterval();

    this.realtimeUnsubscribe = subscribeToRemoteSyncOperations({
      userId: userId ?? getCachedUserId(),
      onRemoteChange: () => this.scheduleRemoteDebouncedSync(),
      onResubscribe: () => this.runThrottledSync(),
    });

    this.onlineHandler = () => this.runThrottledSync();
    window.addEventListener("online", this.onlineHandler);

    this.visibilityHandler = () => {
      if (document.visibilityState === "visible") this.runThrottledSync();
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);

    this.pageShowHandler = () => this.runThrottledSync();
    window.addEventListener("pageshow", this.pageShowHandler);
  }

  stopAutoSync(): void {
    this.isAutoSyncEnabled = false;
    clearSyncScheduler();

    this.clearDebounceTimer();
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    unsubscribeFromRemoteSyncOperations();

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.pageShowHandler) {
      window.removeEventListener("pageshow", this.pageShowHandler);
      this.pageShowHandler = null;
    }
  }
}

export const syncEngine = new SyncEngine();
