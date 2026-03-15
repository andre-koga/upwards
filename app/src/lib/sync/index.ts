import { db } from "@/lib/db";
import {
  supabase,
  getCachedUserId,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { getErrorMessage, ERROR_MESSAGES } from "@/lib/error-utils";
import { loadLastSyncAt, saveLastSyncAt } from "./sync-storage";
import {
  type SyncTable,
  toRemoteRow,
  dedupeRowsForUpsert,
  UPSERT_CONFLICT_TARGET,
  parseTimestamp,
} from "./sync-transformers";
import {
  sanitizeForeignKeyRefsBeforeUpsert,
  normalizeActivityStreakIdsBeforeUpsert,
  stripUnknownColumns,
} from "./sanitizers";

const EPOCH = "1970-01-01T00:00:00.000Z";
const DEBOUNCE_SYNC_MS = 5_000;
const DEFAULT_PERIODIC_SYNC_MS = 60_000;
/** Buffer for incremental pull to avoid missing rows due to device clock skew. */
const PULL_BUFFER_MS = 5 * 60 * 1000;

const SYNC_TABLES: SyncTable[] = [
  "activity_groups",
  "activities",
  "daily_entries",
  "activity_periods",
  "journal_entries",
  "one_time_tasks",
  "activity_streaks",
  "memo_periods",
];

const TABLE_MAP: Record<SyncTable, keyof typeof db> = {
  activity_groups: "activityGroups",
  activities: "activities",
  daily_entries: "dailyEntries",
  activity_periods: "activityPeriods",
  journal_entries: "journalEntries",
  one_time_tasks: "oneTimeTasks",
  activity_streaks: "activityStreaks",
  memo_periods: "memoPeriods",
};

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

      localTable.hook("creating", () => {
        if (this.suppressMutationSignals > 0) return;
        this.scheduleDebouncedSync();
      });

      localTable.hook("updating", () => {
        if (this.suppressMutationSignals > 0) return;
        this.scheduleDebouncedSync();
        return undefined;
      });

      localTable.hook("deleting", () => {
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
    return this.pushInternal(false);
  }

  /**
   * Force push: push ALL local Dexie data to Supabase, ignoring synced_at.
   * Use when local data exists but wasn't pushed (e.g. pre-sync data).
   * Call from Settings when user wants to force cloud to match local.
   */
  async forcePushToCloud(): Promise<void> {
    if (!this.canSync() || !supabase) return;
    this.setState({ isSyncing: true, lastError: null });
    try {
      const { failedTables } = await this.pushInternal(true);
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
    }
  }

  private async pushInternal(
    forceAll: boolean
  ): Promise<{ failedTables: string[] }> {
    const failedTables: string[] = [];
    if (!supabase) return { failedTables };
    const userId = getCachedUserId()!;
    if (!userId) return { failedTables };

    for (const table of SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records: any[] = await (db[dexieTable] as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r: any) =>
          forceAll ? true : !r.synced_at || r.updated_at > r.synced_at
        )
        .toArray();

      if (records.length === 0) continue;

      const rows = records
        .map((r) => toRemoteRow(table, r, userId))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const dedupedRows = dedupeRowsForUpsert(table, rows);
      const duplicateCount = rows.length - dedupedRows.length;
      if (duplicateCount > 0) {
        console.warn(
          `[sync] deduped ${duplicateCount} conflicting row(s) on ${table} before upsert`
        );
      }

      const sanitizedRows = await sanitizeForeignKeyRefsBeforeUpsert(
        supabase,
        table,
        dedupedRows,
        userId
      );

      const normalizedRows = await normalizeActivityStreakIdsBeforeUpsert(
        supabase,
        table,
        sanitizedRows,
        userId
      );

      const skippedCount = records.length - rows.length;
      if (skippedCount > 0) {
        console.warn(
          `[sync] skipped ${skippedCount} invalid row(s) on ${table} due to non-UUID id`
        );
      }

      const schemaSafeRows = stripUnknownColumns(table, normalizedRows);

      if (schemaSafeRows.length === 0) {
        const now = new Date().toISOString();
        await this.withSuppressedMutationSignals(async () => {
          await Promise.all(
            records.map((r) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (db[dexieTable] as any).update(r.id, { synced_at: now })
            )
          );
        });
        continue;
      }

      try {
        const { error } = await supabase.from(table).upsert(schemaSafeRows, {
          onConflict: UPSERT_CONFLICT_TARGET[table],
        });

        if (error) {
          failedTables.push(table);
          console.warn(
            `[sync] push failed for ${table}, continuing with other tables:`,
            error.message
          );
          continue;
        }

        const now = new Date().toISOString();
        await this.withSuppressedMutationSignals(async () => {
          await Promise.all(
            records.map((r) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (db[dexieTable] as any).update(r.id, { synced_at: now })
            )
          );
        });
      } catch (err) {
        failedTables.push(table);
        console.warn(
          `[sync] push failed for ${table}, continuing with other tables:`,
          err
        );
      }
    }

    return { failedTables };
  }

  async pull(): Promise<void> {
    if (!this.canSync() || !supabase) return;
    const userId = getCachedUserId()!;
    const lastSync = this.state.lastSyncAt ?? null;
    const fullSince = EPOCH;

    // Reference tables: always pull all so child records find their refs.
    // activity_periods: full pull so timeline never misses the latest period (clock skew).
    const FULL_PULL_TABLES: SyncTable[] = [
      "activity_groups",
      "activities",
      "daily_entries",
      "activity_periods",
    ];

    for (const table of SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];
      const shouldFullPull = FULL_PULL_TABLES.includes(table);
      const since = shouldFullPull
        ? fullSince
        : (() => {
            if (!lastSync) return fullSince;
            const sinceMs = Math.max(
              0,
              parseTimestamp(lastSync) - PULL_BUFFER_MS
            );
            return new Date(sinceMs).toISOString();
          })();

      const query = supabase.from(table).select("*").eq("user_id", userId);

      const { data, error } = await (shouldFullPull
        ? query
        : query.gt("updated_at", since));

      if (error) {
        throw new Error(`Pull error on ${table}: ${error.message}`);
      }

      if (!data || data.length === 0) continue;

      await this.withSuppressedMutationSignals(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[dexieTable] as any).bulkPut(
          data.map((r) => ({ ...r, synced_at: r.updated_at }))
        );
      });
    }

    const now = new Date().toISOString();
    saveLastSyncAt(now);
    this.setState({ lastSyncAt: now });
  }

  async sync(): Promise<void> {
    if (!this.canSync()) return;
    if (this.state.isSyncing) return;
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
