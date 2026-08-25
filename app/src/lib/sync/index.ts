import { db } from "@/lib/db";
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
} from "./sync-storage";
import type { SyncTable } from "./sync-transformers";
import {
  DEBOUNCE_SYNC_MS,
  REMOTE_DEBOUNCE_SYNC_MS,
  DEFAULT_PERIODIC_SYNC_MS,
  MAX_CHAINED_SYNCS,
  SYNC_TABLES,
  TABLE_MAP,
} from "./sync-constants";
import { runPushInternal } from "./sync-push";
import { runPull } from "./sync-pull";
import {
  pushPendingOperations,
  pullAndApplyOperations,
} from "./sync-operations";
import { recordSyncIssue, resolveOpenSyncErrors } from "./sync-issues-store";
import { touchLocalDevice } from "./device-id";
import {
  enqueueProjectionUpsertForTable,
  OPS_MANAGED_SYNC_TABLES,
} from "./projection-sync";
import { reportOpsUnavailablePending, countPendingOperations } from "./pending-operations";
import {
  subscribeToRemoteSyncOperations,
  unsubscribeFromRemoteSyncOperations,
} from "./realtime-sync";
import { syncDeviceRegistry } from "./remote-device-sync";
import { countUnsyncedRows } from "./unsynced-data";

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
  private hasMutationHooks = false;
  private suppressMutationSignals = 0;
  /** True only while applying remote rows from pull (bulkPut). */
  private applyRemoteFromPull = false;
  /** True while writing synced_at after a successful push (not user data). */
  private applyLocalSyncMetadata = false;
  /** Row ids touched by the user (or app) while a sync was in progress; pull skips these. */
  private dirtyIdsByTable = new Map<SyncTable, Set<string>>();
  /** Another sync was requested while one was already running. */
  private pendingResync = false;
  /** Counts follow-up syncs scheduled from `sync()`'s finally (dirty / pending); resets when a run finishes with nothing left to do. */
  private followUpSyncChain = 0;
  /** Timestamp of the last time a triggered sync actually ran (ms). Used to throttle focus/online triggers. */
  private lastTriggeredSyncMs = 0;
  /** Minimum ms between focus/online-triggered syncs to avoid redundant pulls on rapid tab switches. */
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

  private withSuppressedMutationSignals<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    this.suppressMutationSignals += 1;
    return operation().finally(() => {
      this.suppressMutationSignals -= 1;
    });
  }

  private withLocalSyncMetadataWrites<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    this.applyLocalSyncMetadata = true;
    return this.withSuppressedMutationSignals(operation).finally(() => {
      this.applyLocalSyncMetadata = false;
    });
  }

  private markDirtyIfUserMutationDuringSync(
    table: SyncTable,
    rowId: string | undefined
  ): void {
    if (!rowId) return;
    if (!this.state.isSyncing) return;
    if (this.applyRemoteFromPull || this.applyLocalSyncMetadata) return;
    let set = this.dirtyIdsByTable.get(table);
    if (!set) {
      set = new Set<string>();
      this.dirtyIdsByTable.set(table, set);
    }
    set.add(rowId);
  }

  private hasDirtyIds(): boolean {
    for (const set of this.dirtyIdsByTable.values()) {
      if (set.size > 0) return true;
    }
    return false;
  }

  private clearDirtyIds(): void {
    this.dirtyIdsByTable.clear();
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

  private scheduleDebouncedSync(): void {
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

  private registerMutationHooks(): void {
    if (this.hasMutationHooks) return;

    for (const table of SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localTable = db[dexieTable] as any;

      localTable.hook("creating", (primKey: unknown, obj: { id?: string }) => {
        const id =
          primKey !== undefined && primKey !== null
            ? String(primKey)
            : obj?.id !== undefined
              ? String(obj.id)
              : undefined;
        this.markDirtyIfUserMutationDuringSync(table, id);
        if (this.suppressMutationSignals > 0) return;
        this.scheduleDebouncedSync();
      });

      localTable.hook(
        "updating",
        (_modifications: unknown, primKey: unknown) => {
          const id =
            primKey !== undefined && primKey !== null
              ? String(primKey)
              : undefined;
          this.markDirtyIfUserMutationDuringSync(table, id);
          if (this.suppressMutationSignals > 0) return;
          this.scheduleDebouncedSync();
          return undefined;
        }
      );

      localTable.hook("deleting", (primKey: unknown) => {
        const id =
          primKey !== undefined && primKey !== null
            ? String(primKey)
            : undefined;
        this.markDirtyIfUserMutationDuringSync(table, id);
        if (this.suppressMutationSignals > 0) return;
        this.scheduleDebouncedSync();
      });
    }

    this.hasMutationHooks = true;

    for (const table of OPS_MANAGED_SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localTable = db[dexieTable] as any;

      localTable.hook(
        "creating",
        (primKey: unknown, obj: Record<string, unknown>) => {
          const id =
            primKey !== undefined && primKey !== null
              ? String(primKey)
              : obj?.id !== undefined
                ? String(obj.id)
                : undefined;
          if (!id) return;
          void enqueueProjectionUpsertForTable(table, { ...obj, id });
        }
      );

      localTable.hook(
        "updating",
        (
          mods: Record<string, unknown>,
          primKey: unknown,
          obj: Record<string, unknown>
        ) => {
          const id =
            primKey !== undefined && primKey !== null
              ? String(primKey)
              : undefined;
          if (!id) return;
          const baseRevision =
            typeof obj.updated_at === "string" ? obj.updated_at : null;
          void enqueueProjectionUpsertForTable(
            table,
            { ...obj, ...mods, id },
            baseRevision
          );
        }
      );
    }
  }

  private canSync(): boolean {
    if (!isSupabaseConfigured || !supabase) return false;
    if (!getCachedUserId()) return false;
    return true;
  }

  async push(): Promise<{ failedTables: string[] }> {
    if (!this.canSync() || !supabase) return { failedTables: [] };
    return runPushInternal(
      {
        withLocalSyncMetadataWrites: (op) =>
          this.withLocalSyncMetadataWrites(op),
      },
      { opsSyncActive: false }
    );
  }

  async pull(options?: { opsSyncActive?: boolean }): Promise<void> {
    if (!this.canSync() || !supabase) return;
    const userId = getCachedUserId();
    if (!userId) return;

    const serverNow = await runPull({
      supabase,
      userId,
      lastServerSyncAt: this.state.lastSyncAt ?? null,
      dirtyIdsByTable: this.dirtyIdsByTable,
      withSuppressedMutationSignals: (op) =>
        this.withSuppressedMutationSignals(op),
      setApplyRemoteFromPull: (value) => {
        this.applyRemoteFromPull = value;
      },
      opsSyncActive: options?.opsSyncActive ?? false,
    });
    this.setState({ lastSyncAt: serverNow });
    void touchLocalDevice(userId);
    void syncDeviceRegistry(userId);
  }

  async sync(): Promise<void> {
    if (!this.canSync()) return;
    if (this.state.isSyncing) {
      this.pendingResync = true;
      return;
    }

    this.clearDirtyIds();
    this.setState({ isSyncing: true, lastError: null });
    let opsSkipped = false;
    let interruptedTransiently = false;
    try {
      const pushOpsResult = await pushPendingOperations();
      opsSkipped = pushOpsResult.skipped === true;
      const opsSyncActive = pushOpsResult.skipped !== true;
      // Do not advance the pull cursor from a push. Submitted sequences can be
      // higher than ops we have not pulled yet (other devices), which would
      // skip remote period tombstones and similar projection ops.

      // Transient ops push failure should not become a durable Sync error card.
      if (pushOpsResult.failed && pushOpsResult.transient) {
        interruptedTransiently = true;
      } else if (pushOpsResult.failed) {
        const msg =
          "Some pending changes could not be uploaded. Try syncing again.";
        logError("Sync ops push failed", new Error(msg));
        this.setState({ lastError: msg });
      }

      const { failedTables, hadTransientFailure, hadDurableFailure } =
        await runPushInternal(
          {
            withLocalSyncMetadataWrites: (op) =>
              this.withLocalSyncMetadataWrites(op),
          },
          { opsSyncActive }
        );
      if (failedTables.length > 0) {
        if (hadDurableFailure) {
          const msg = `Some data couldn't be uploaded (${failedTables.join(", ")}). Try syncing again.`;
          logError("Sync push failed", new Error(msg));
          this.setState({ lastError: msg });
        } else if (hadTransientFailure) {
          interruptedTransiently = true;
        }
      }
      await this.pull({ opsSyncActive });

      const pullOpsResult = await pullAndApplyOperations(
        loadLastAppliedSequence()
      );
      if (pullOpsResult.skipped === true) {
        opsSkipped = true;
      }
      if (pullOpsResult.skipped !== true && pullOpsResult.maxSequence != null) {
        advanceLastAppliedSequence(pullOpsResult.maxSequence);
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
          if (opsSkipped) {
            await reportOpsUnavailablePending();
          }
          await resolveOpenSyncErrors();
        } catch (cleanupErr) {
          console.warn("[sync] post-sync cleanup failed:", cleanupErr);
        }
      }

      const needsAnother = this.pendingResync || this.hasDirtyIds();
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
      const opsSyncActive = pushOpsResult.skipped !== true;
      if (pushOpsResult.failed) {
        pushFailed = true;
      }
      const { hadDurableFailure } = await runPushInternal(
        {
          withLocalSyncMetadataWrites: (op) =>
            this.withLocalSyncMetadataWrites(op),
        },
        { opsSyncActive }
      );
      if (hadDurableFailure) {
        pushFailed = true;
      }
    } catch (err) {
      pushFailed = true;
      console.warn("[sync] pushBeforeSignOut failed:", err);
    }

    const [pendingCount, unsyncedRowCount] = await Promise.all([
      countPendingOperations({ status: "pending" }),
      countUnsyncedRows(),
    ]);

    return {
      success:
        !pushFailed && pendingCount === 0 && unsyncedRowCount === 0,
      pendingCount,
      unsyncedRowCount,
      pushFailed,
    };
  }

  /**
   * Called after local Dexie tables have been wiped (sign-out or account switch).
   * Resets in-memory sync state so the next sign-in starts from a clean slate.
   */
  resetAfterLocalClear(): void {
    this.clearDirtyIds();
    this.pendingResync = false;
    this.followUpSyncChain = 0;
    clearLastServerSyncAt();
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
    this.registerMutationHooks();

    // Full sync on app start / page reload once auth is ready.
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
