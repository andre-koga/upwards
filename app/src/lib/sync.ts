import { db } from './db'
import { supabase, getCachedUserId, isSupabaseConfigured } from './supabase'

const LAST_SYNC_KEY = 'okhabit_last_sync_at'
const EPOCH = '1970-01-01T00:00:00.000Z'

// ─── Tables that are synced ───────────────────────────────────────────────────
const SYNC_TABLES = [
    'activity_groups',
    'activities',
    'daily_entries',
    'activity_periods',
    'journal_entries',
    'one_time_tasks',
    'activity_streaks',
] as const

type SyncTable = (typeof SYNC_TABLES)[number]

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TABLE_MAP: Record<SyncTable, keyof typeof db> = {
    activity_groups: 'activityGroups',
    activities: 'activities',
    daily_entries: 'dailyEntries',
    activity_periods: 'activityPeriods',
    journal_entries: 'journalEntries',
    one_time_tasks: 'oneTimeTasks',
    activity_streaks: 'activityStreaks',
}

const UPSERT_CONFLICT_TARGET: Record<SyncTable, string> = {
    activity_groups: 'id',
    activities: 'id',
    daily_entries: 'user_id,date',
    activity_periods: 'id',
    journal_entries: 'user_id,entry_date',
    one_time_tasks: 'id',
    activity_streaks: 'user_id,activity_id,date',
}

// ─── State & pub/sub ─────────────────────────────────────────────────────────

export interface SyncState {
    isSyncing: boolean
    lastSyncAt: string | null
    lastError: string | null
}

type StateListener = (state: SyncState) => void

function isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_REGEX.test(value)
}

function sanitizeUuidReferences(
    table: SyncTable,
    row: Record<string, unknown>
): Record<string, unknown> {
    const sanitized = { ...row }

    if (table === 'activities' && !isValidUuid(sanitized.group_id)) {
        sanitized.group_id = null
    }

    if (table === 'daily_entries' && !isValidUuid(sanitized.current_activity_id)) {
        sanitized.current_activity_id = null
    }

    if (table === 'activity_periods') {
        if (!isValidUuid(sanitized.daily_entry_id)) {
            sanitized.daily_entry_id = null
        }
        if (!isValidUuid(sanitized.activity_id)) {
            sanitized.activity_id = null
        }
    }

    if (table === 'activity_streaks' && !isValidUuid(sanitized.activity_id)) {
        sanitized.activity_id = null
    }

    return sanitized
}

function toRemoteRow<T extends Record<string, unknown>>(
    table: SyncTable,
    record: T,
    userId: string
): (Omit<T, 'synced_at'> & { user_id: string }) | null {
    const remoteRecord = {
        ...(record as T & { synced_at?: unknown }),
    } as Record<string, unknown>

    if (!isValidUuid(remoteRecord.id)) {
        return null
    }

    delete remoteRecord.synced_at
    return {
        ...sanitizeUuidReferences(table, remoteRecord),
        user_id: userId,
    } as Omit<T, 'synced_at'> & { user_id: string }
}

function parseTimestamp(value: unknown): number {
    if (typeof value !== 'string') return 0
    const ts = Date.parse(value)
    return Number.isNaN(ts) ? 0 : ts
}

function dedupeRowsForUpsert<T extends Record<string, unknown>>(
    table: SyncTable,
    rows: T[]
): T[] {
    const conflictCols = UPSERT_CONFLICT_TARGET[table]
        .split(',')
        .map((s) => s.trim())

    const byConflictKey = new Map<string, T>()

    for (const row of rows) {
        const conflictKey = conflictCols
            .map((col) => String(row[col] ?? ''))
            .join('|')

        const existing = byConflictKey.get(conflictKey)
        if (!existing) {
            byConflictKey.set(conflictKey, row)
            continue
        }

        const existingTs = parseTimestamp(existing.updated_at)
        const incomingTs = parseTimestamp(row.updated_at)
        if (incomingTs >= existingTs) {
            byConflictKey.set(conflictKey, row)
        }
    }

    return Array.from(byConflictKey.values())
}

function loadLastSyncAt(): string | null {
    return localStorage.getItem(LAST_SYNC_KEY) ?? null
}

function saveLastSyncAt(ts: string): void {
    localStorage.setItem(LAST_SYNC_KEY, ts)
}

// ─── SyncEngine ───────────────────────────────────────────────────────────────

export class SyncEngine {
    private state: SyncState = {
        isSyncing: false,
        lastSyncAt: loadLastSyncAt(),
        lastError: null,
    }
    private listeners = new Set<StateListener>()
    private syncInterval: ReturnType<typeof setInterval> | null = null
    private onlineHandler: (() => void) | null = null
    private visibilityHandler: (() => void) | null = null

    // ── Pub/sub ─────────────────────────────────────────────────────────────────

    getState(): SyncState {
        return this.state
    }

    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private setState(patch: Partial<SyncState>): void {
        this.state = { ...this.state, ...patch }
        this.listeners.forEach((l) => l(this.state))
    }

    // ── Sync guard ──────────────────────────────────────────────────────────────

    private canSync(): boolean {
        if (!isSupabaseConfigured || !supabase) return false
        if (!getCachedUserId()) return false
        return true
    }

    // ── Push (local → remote) ──────────────────────────────────────────────────

    async push(): Promise<void> {
        if (!this.canSync() || !supabase) return
        const userId = getCachedUserId()!

        for (const table of SYNC_TABLES) {
            const dexieTable = TABLE_MAP[table]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const records: any[] = await (db[dexieTable] as any)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((r: any) => !r.synced_at || r.updated_at > r.synced_at)
                .toArray()

            if (records.length === 0) continue

            const rows = records
                .map((r) => toRemoteRow(table, r, userId))
                .filter((r): r is NonNullable<typeof r> => r !== null)

            const dedupedRows = dedupeRowsForUpsert(table, rows)
            const duplicateCount = rows.length - dedupedRows.length
            if (duplicateCount > 0) {
                console.warn(
                    `[sync] deduped ${duplicateCount} conflicting row(s) on ${table} before upsert`
                )
            }

            const skippedCount = records.length - rows.length
            if (skippedCount > 0) {
                console.warn(
                    `[sync] skipped ${skippedCount} invalid row(s) on ${table} due to non-UUID id`
                )
            }

            if (dedupedRows.length === 0) {
                const now = new Date().toISOString()
                await Promise.all(
                    records.map((r) =>
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (db[dexieTable] as any).update(r.id, { synced_at: now })
                    )
                )
                continue
            }

            const { error } = await supabase
                .from(table)
                .upsert(dedupedRows, { onConflict: UPSERT_CONFLICT_TARGET[table] })

            if (error) {
                throw new Error(`Push error on ${table}: ${error.message}`)
            }

            const now = new Date().toISOString()
            await Promise.all(
                records.map((r) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (db[dexieTable] as any).update(r.id, { synced_at: now })
                )
            )
        }
    }

    // ── Pull (remote → local) ──────────────────────────────────────────────────

    async pull(): Promise<void> {
        if (!this.canSync() || !supabase) return
        const userId = getCachedUserId()!
        const since = this.state.lastSyncAt ?? EPOCH

        for (const table of SYNC_TABLES) {
            const dexieTable = TABLE_MAP[table]

            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('user_id', userId)
                .gt('updated_at', since)

            if (error) {
                throw new Error(`Pull error on ${table}: ${error.message}`)
            }

            if (!data || data.length === 0) continue

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (db[dexieTable] as any).bulkPut(
                data.map((r) => ({ ...r, synced_at: r.updated_at }))
            )
        }

        const now = new Date().toISOString()
        saveLastSyncAt(now)
        this.setState({ lastSyncAt: now })
    }

    // ── Full sync ──────────────────────────────────────────────────────────────

    async sync(): Promise<void> {
        if (!this.canSync()) return
        if (this.state.isSyncing) return
        this.setState({ isSyncing: true, lastError: null })
        try {
            await this.push()
            await this.pull()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown sync error'
            this.setState({ lastError: msg })
        } finally {
            this.setState({ isSyncing: false })
        }
    }

    /** Push pending changes before signing out. Does not throw. */
    async pushBeforeSignOut(): Promise<void> {
        try {
            await this.push()
        } catch (err) {
            console.warn('[sync] pushBeforeSignOut failed (non-fatal):', err)
        }
    }

    // ── Auto-sync lifecycle ────────────────────────────────────────────────────

    startAutoSync(intervalMs = 30_000): void {
        this.stopAutoSync()

        void this.sync()

        this.syncInterval = setInterval(() => void this.sync(), intervalMs)

        this.onlineHandler = () => void this.sync()
        window.addEventListener('online', this.onlineHandler)

        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible') void this.sync()
        }
        document.addEventListener('visibilitychange', this.visibilityHandler)
    }

    stopAutoSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval)
            this.syncInterval = null
        }
        if (this.onlineHandler) {
            window.removeEventListener('online', this.onlineHandler)
            this.onlineHandler = null
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler)
            this.visibilityHandler = null
        }
    }
}

export const syncEngine = new SyncEngine()
