import { db, newId } from "@/lib/db";
import { supabase, getCachedUserId, isSupabaseConfigured } from "@/lib/supabase";
import { loadLastSyncAt, saveLastSyncAt } from "./sync-storage";
import {
  type SyncTable,
  isValidUuid,
  toRemoteRow,
  dedupeRowsForUpsert,
  UPSERT_CONFLICT_TARGET,
} from "./sync-transformers";

const EPOCH = "1970-01-01T00:00:00.000Z";
const DEBOUNCE_SYNC_MS = 5_000;
const DEFAULT_PERIODIC_SYNC_MS = 60_000;

const SYNC_TABLES: SyncTable[] = [
  "activity_groups",
  "activities",
  "daily_entries",
  "activity_periods",
  "journal_entries",
  "one_time_tasks",
  "activity_streaks",
];

const TABLE_MAP: Record<SyncTable, keyof typeof db> = {
  activity_groups: "activityGroups",
  activities: "activities",
  daily_entries: "dailyEntries",
  activity_periods: "activityPeriods",
  journal_entries: "journalEntries",
  one_time_tasks: "oneTimeTasks",
  activity_streaks: "activityStreaks",
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
    operation: () => Promise<T>,
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
      this.periodicIntervalMs,
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

  private async sanitizeForeignKeyRefsBeforeUpsert(
    table: SyncTable,
    rows: Array<Record<string, unknown>>,
    userId: string,
  ): Promise<Array<Record<string, unknown>>> {
    if (rows.length === 0) return rows;
    const supabaseClient = supabase;
    if (!supabaseClient) return rows;

    if (table === "activity_periods" || table === "activity_streaks") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activityIdsRaw: any[] = await (db.activities as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => !a.deleted_at)
        .primaryKeys();
      const validActivityIds = new Set(
        activityIdsRaw
          .map((id) => String(id))
          .filter((id) => isValidUuid(id)),
      );

      let missingActivityRefCount = 0;
      let withActivityRefs = rows.map((row) => {
        if (!row.activity_id || !isValidUuid(row.activity_id)) {
          return row;
        }
        if (validActivityIds.has(row.activity_id)) {
          return row;
        }
        missingActivityRefCount += 1;
        return { ...row, activity_id: null };
      });

      if (missingActivityRefCount > 0) {
        console.warn(
          `[sync] nulled ${missingActivityRefCount} missing activity_id reference(s) on ${table}`,
        );
      }

      rows = withActivityRefs;

      const referencedActivityIds = Array.from(
        new Set(
          rows
            .map((row) => row.activity_id)
            .filter((id): id is string => isValidUuid(id)),
        ),
      );

      if (referencedActivityIds.length > 0) {
        const { data: remoteActivities, error: remoteActivitiesError } =
          await supabaseClient
            .from("activities")
            .select("id")
            .eq("user_id", userId)
            .in("id", referencedActivityIds);

        if (!remoteActivitiesError) {
          const remoteActivityIds = new Set(
            (remoteActivities ?? []).map((a) => a.id),
          );

          let missingRemoteActivityRefCount = 0;
          rows = rows.map((row) => {
            if (!row.activity_id || !isValidUuid(row.activity_id)) {
              return row;
            }
            if (remoteActivityIds.has(row.activity_id)) {
              return row;
            }
            missingRemoteActivityRefCount += 1;
            return { ...row, activity_id: null };
          });

          if (missingRemoteActivityRefCount > 0) {
            console.warn(
              `[sync] nulled ${missingRemoteActivityRefCount} non-existent remote activity_id reference(s) on ${table}`,
            );
          }
        }
      }
    }

    if (table === "activity_periods") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dailyEntryIdsRaw: any[] = await (db.dailyEntries as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((d: any) => !d.deleted_at)
        .primaryKeys();
      const validDailyEntryIds = new Set(
        dailyEntryIdsRaw
          .map((id) => String(id))
          .filter((id) => isValidUuid(id)),
      );

      let missingDailyEntryRefCount = 0;
      let withDailyEntryRefs = rows.map((row) => {
        if (!row.daily_entry_id || !isValidUuid(row.daily_entry_id)) {
          return row;
        }
        if (validDailyEntryIds.has(row.daily_entry_id)) {
          return row;
        }
        missingDailyEntryRefCount += 1;
        return { ...row, daily_entry_id: null };
      });

      if (missingDailyEntryRefCount > 0) {
        console.warn(
          `[sync] nulled ${missingDailyEntryRefCount} missing daily_entry_id reference(s) on ${table}`,
        );
      }

      rows = withDailyEntryRefs;

      const referencedDailyEntryIds = Array.from(
        new Set(
          rows
            .map((row) => row.daily_entry_id)
            .filter((id): id is string => isValidUuid(id)),
        ),
      );

      if (referencedDailyEntryIds.length > 0) {
        const { data: remoteDailyEntries, error: remoteDailyEntriesError } =
          await supabaseClient
            .from("daily_entries")
            .select("id")
            .eq("user_id", userId)
            .in("id", referencedDailyEntryIds);

        if (!remoteDailyEntriesError) {
          const remoteDailyEntryIds = new Set(
            (remoteDailyEntries ?? []).map((d) => d.id),
          );

          let missingRemoteDailyEntryRefCount = 0;
          rows = rows.map((row) => {
            if (
              !row.daily_entry_id ||
              !isValidUuid(row.daily_entry_id)
            ) {
              return row;
            }
            if (remoteDailyEntryIds.has(row.daily_entry_id)) {
              return row;
            }
            missingRemoteDailyEntryRefCount += 1;
            return { ...row, daily_entry_id: null };
          });

          if (missingRemoteDailyEntryRefCount > 0) {
            console.warn(
              `[sync] nulled ${missingRemoteDailyEntryRefCount} non-existent remote daily_entry_id reference(s) on ${table}`,
            );
          }
        }
      }
    }

    return rows;
  }

  private async normalizeActivityStreakIdsBeforeUpsert(
    table: SyncTable,
    rows: Array<Record<string, unknown>>,
    userId: string,
  ): Promise<Array<Record<string, unknown>>> {
    if (table !== "activity_streaks" || rows.length === 0) return rows;
    const supabaseClient = supabase;
    if (!supabaseClient) return rows;

    const { data: remoteStreaks, error } = await supabaseClient
      .from("activity_streaks")
      .select("id, activity_id, date")
      .eq("user_id", userId);

    if (error) {
      return rows;
    }

    const remoteCompositeToId = new Map<string, string>();
    const remoteIdToComposite = new Map<string, string>();

    for (const row of remoteStreaks ?? []) {
      const activityId = row.activity_id;
      const date = row.date;
      if (!isValidUuid(activityId) || typeof date !== "string") continue;
      const key = `${activityId}|${date}`;
      remoteCompositeToId.set(key, row.id);
      remoteIdToComposite.set(row.id, key);
    }

    const usedIds = new Set<string>(remoteIdToComposite.keys());
    const normalizedRows: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const activityId = row.activity_id;
      const date = row.date;
      if (!isValidUuid(activityId) || typeof date !== "string") {
        normalizedRows.push(row);
        continue;
      }

      const compositeKey = `${activityId}|${date}`;
      const existingCompositeId = remoteCompositeToId.get(compositeKey);
      if (existingCompositeId) {
        normalizedRows.push({ ...row, id: existingCompositeId });
        usedIds.add(existingCompositeId);
        continue;
      }

      const rowId = row.id;
      const needsFreshId =
        !isValidUuid(rowId) ||
        usedIds.has(rowId) ||
        Boolean(
          remoteIdToComposite.get(rowId) &&
            remoteIdToComposite.get(rowId) !== compositeKey,
        );

      if (needsFreshId) {
        let generatedId = newId();
        while (usedIds.has(generatedId)) {
          generatedId = newId();
        }
        usedIds.add(generatedId);
        normalizedRows.push({ ...row, id: generatedId });
        continue;
      }

      usedIds.add(rowId);
      normalizedRows.push(row);
    }

    return normalizedRows;
  }

  async push(): Promise<void> {
    if (!this.canSync() || !supabase) return;
    const userId = getCachedUserId()!;

    for (const table of SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records: any[] = await (db[dexieTable] as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r: any) => !r.synced_at || r.updated_at > r.synced_at)
        .toArray();

      if (records.length === 0) continue;

      const rows = records
        .map((r) => toRemoteRow(table, r, userId))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const dedupedRows = dedupeRowsForUpsert(table, rows);
      const duplicateCount = rows.length - dedupedRows.length;
      if (duplicateCount > 0) {
        console.warn(
          `[sync] deduped ${duplicateCount} conflicting row(s) on ${table} before upsert`,
        );
      }

      const sanitizedRows = await this.sanitizeForeignKeyRefsBeforeUpsert(
        table,
        dedupedRows,
        userId,
      );

      const normalizedRows =
        await this.normalizeActivityStreakIdsBeforeUpsert(
          table,
          sanitizedRows,
          userId,
        );

      const skippedCount = records.length - rows.length;
      if (skippedCount > 0) {
        console.warn(
          `[sync] skipped ${skippedCount} invalid row(s) on ${table} due to non-UUID id`,
        );
      }

      if (normalizedRows.length === 0) {
        const now = new Date().toISOString();
        await this.withSuppressedMutationSignals(async () => {
          await Promise.all(
            records.map((r) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (db[dexieTable] as any).update(r.id, { synced_at: now }),
            ),
          );
        });
        continue;
      }

      const { error } = await supabase
        .from(table)
        .upsert(normalizedRows, {
          onConflict: UPSERT_CONFLICT_TARGET[table],
        });

      if (error) {
        throw new Error(`Push error on ${table}: ${error.message}`);
      }

      const now = new Date().toISOString();
      await this.withSuppressedMutationSignals(async () => {
        await Promise.all(
          records.map((r) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db[dexieTable] as any).update(r.id, { synced_at: now }),
          ),
        );
      });
    }
  }

  async pull(): Promise<void> {
    if (!this.canSync() || !supabase) return;
    const userId = getCachedUserId()!;
    const since = this.state.lastSyncAt ?? EPOCH;

    for (const table of SYNC_TABLES) {
      const dexieTable = TABLE_MAP[table];

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", since);

      if (error) {
        throw new Error(`Pull error on ${table}: ${error.message}`);
      }

      if (!data || data.length === 0) continue;

      await this.withSuppressedMutationSignals(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[dexieTable] as any).bulkPut(
          data.map((r) => ({ ...r, synced_at: r.updated_at })),
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
      await this.push();
      await this.pull();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown sync error";
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
      document.removeEventListener(
        "visibilitychange",
        this.visibilityHandler,
      );
      this.visibilityHandler = null;
    }
  }
}

export const syncEngine = new SyncEngine();
