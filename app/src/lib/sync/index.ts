import { db } from "@/lib/db";
import {
  supabase,
  getCachedUserId,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { getErrorMessage, ERROR_MESSAGES } from "@/lib/error-utils";
import { loadLastSyncAt } from "./sync-storage";
import type { SyncTable } from "./sync-transformers";
import {
  DEBOUNCE_SYNC_MS,
  DEFAULT_PERIODIC_SYNC_MS,
  MAX_CHAINED_SYNCS,
  SYNC_TABLES,
  TABLE_MAP,
} from "./sync-constants";
import { runPushInternal } from "./sync-push";
import { runPull } from "./sync-pull";

export interface SyncState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

type StateListener = (state: SyncState) => void;

export class SyncEngine {
  private state: SyncState = {
    isSyncing: false,
    lastSyncAt: loadLastSyncAt(),
    lastError: null,
  };
  private listeners = new Set<StateListener>();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
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

  getState(): SyncState {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<SyncState>): void {
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
    void this.sync();
  }

  private scheduleDebouncedSync(): void {
    if (!this.isAutoSyncEnabled) return;

    this.clearDebounceTimer();

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.runTriggeredSync();
    }, DEBOUNCE_SYNC_MS);
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
      { forceAll: false }
    );
  }

  /**
   * Force push: push ALL local Dexie data to Supabase, ignoring synced_at.
   * Use when local data exists but wasn't pushed (e.g. pre-sync data).
   * Call from Settings when user wants to force cloud to match local.
   */
  async forcePushToCloud(): Promise<void> {
    if (!this.canSync() || !supabase) return;
    this.clearDirtyIds();
    this.setState({ isSyncing: true, lastError: null });
    try {
      const { failedTables } = await runPushInternal(
        {
          withLocalSyncMetadataWrites: (op) =>
            this.withLocalSyncMetadataWrites(op),
        },
        { forceAll: true }
      );
      if (failedTables.length > 0) {
        this.setState({
          lastError: `Upload failed for: ${failedTables.join(", ")}. Try again.`,
        });
      }
    } catch (err) {
      const msg = getErrorMessage(err, ERROR_MESSAGES.SYNC);
      this.setState({ lastError: msg });
    } finally {
      this.setState({ isSyncing: false });
      if (this.hasDirtyIds() && this.canSync()) {
        void this.sync();
      }
    }
  }

  async pull(): Promise<void> {
    if (!this.canSync() || !supabase) return;
    const userId = getCachedUserId();
    if (!userId) return;

    const now = await runPull({
      supabase,
      userId,
      lastSyncAt: this.state.lastSyncAt ?? null,
      dirtyIdsByTable: this.dirtyIdsByTable,
      withSuppressedMutationSignals: (op) =>
        this.withSuppressedMutationSignals(op),
      setApplyRemoteFromPull: (value) => {
        this.applyRemoteFromPull = value;
      },
    });
    this.setState({ lastSyncAt: now });
  }

  async sync(): Promise<void> {
    if (!this.canSync()) return;
    if (this.state.isSyncing) {
      this.pendingResync = true;
      return;
    }

    this.clearDirtyIds();
    this.setState({ isSyncing: true, lastError: null });
    try {
      const { failedTables } = await this.push();
      if (failedTables.length > 0) {
        this.setState({
          lastError: `Some data couldn't be uploaded (${failedTables.join(", ")}). Try syncing again.`,
        });
      }
      await this.pull();
    } catch (err) {
      const msg = getErrorMessage(err, ERROR_MESSAGES.SYNC);
      this.setState({ lastError: msg });
    } finally {
      this.setState({ isSyncing: false });

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

  async pushBeforeSignOut(): Promise<void> {
    try {
      await this.push();
    } catch (err) {
      console.warn("[sync] pushBeforeSignOut failed (non-fatal):", err);
    }
  }

  startAutoSync(intervalMs = DEFAULT_PERIODIC_SYNC_MS): void {
    this.stopAutoSync();

    this.isAutoSyncEnabled = true;
    this.periodicIntervalMs = intervalMs;
    this.registerMutationHooks();

    void this.sync();

    this.resetPeriodicInterval();

    this.onlineHandler = () => this.runTriggeredSync();
    window.addEventListener("online", this.onlineHandler);

    this.visibilityHandler = () => {
      if (document.visibilityState === "visible") this.runTriggeredSync();
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  stopAutoSync(): void {
    this.isAutoSyncEnabled = false;

    this.clearDebounceTimer();

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
  }
}

export const syncEngine = new SyncEngine();
