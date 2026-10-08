import { isSupabaseConfigured } from "@/lib/supabase";
import {
  BACKUP_FORMAT,
  BACKUP_TABLE_NAMES,
  emptyBackupTables,
} from "@/lib/backup/format";
import {
  clearLastDataEpoch,
  clearLastServerSyncAt,
  clearSyncProtocolV2,
  loadLastSignedInUserId,
} from "@/lib/sync/sync-storage";
import { LOCAL_DB_NAME, MIN_UPGRADABLE_VERSION } from "./index";

/**
 * The reset path for a local database the baseline schema cannot open
 * (product-scope.md §2.10).
 *
 * Two cases reach it, both decided before Dexie touches the database:
 * - `old_schema`: older than v32. Its rows are in shapes only the deleted
 *   upgrade chain knew, so they are dumped raw and converted by the backup
 *   migrators, which carry the same rules.
 * - `unowned_data`: rows but no remembered account. Sign-out empties the
 *   database before forgetting the user, so this is data created signed out.
 *   It replaces the guest handoff: the rows are kept, never pushed under an
 *   identity the account does not use.
 *
 * Either way the rows go to a separate database first, the local one is
 * deleted, and the device bootstraps from the server snapshot. The bundle is
 * then imported through the idempotent backup import, so anything the server
 * already has merges without double counts and journal differences land on
 * Sync issues. Nothing is pushed straight from the old queue: the rows already
 * carry every change it held, and old operation shapes would be rejected and
 * block the bootstrap.
 */

export type RecoveryReason = "old_schema" | "unowned_data";

export interface RecoveryBundle {
  saved_at: string;
  reason: RecoveryReason;
  /** Account the rows belonged to. Null for data created signed out. */
  source_user_id: string | null;
  /** Local schema version the rows came from. */
  from_version: number;
  /** A backup document `migrateBackupDocument` accepts. */
  document: Record<string, unknown>;
  imported_at: string | null;
  last_error: string | null;
}

const RECOVERY_DB_NAME = "upwards-recovery";
const RECOVERY_STORE = "bundles";

/** User-owned stores, including ones only pre-baseline databases have. */
const USER_STORES: readonly string[] = [
  ...BACKUP_TABLE_NAMES,
  "recurringMemos",
  "activityStatusEvents",
  "groupStatusEvents",
];

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Opens an existing database at its own version; never creates one. */
function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    let missing = false;
    req.onupgradeneeded = () => {
      missing = true;
      req.transaction?.abort();
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = (event) => {
      if (!missing) return reject(req.error);
      event.preventDefault();
      resolve(null);
    };
  });
}

async function readStores(
  idb: IDBDatabase,
  names: string[]
): Promise<Record<string, unknown[]>> {
  if (names.length === 0) return {};
  const tx = idb.transaction(names, "readonly");
  const entries = await Promise.all(
    names.map(
      async (name) =>
        [name, await request(tx.objectStore(name).getAll())] as const
    )
  );
  return Object.fromEntries(entries);
}

async function countUserRows(idb: IDBDatabase): Promise<number> {
  const names = USER_STORES.filter((name) =>
    idb.objectStoreNames.contains(name)
  );
  if (names.length === 0) return 0;
  const tx = idb.transaction(names, "readonly");
  const counts = await Promise.all(
    names.map((name) => request(tx.objectStore(name).count()))
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * v32 rows are already the current model, so they are a current-format
 * document. Anything older uses the legacy layout, which runs every
 * conversion (v4 → v5 → v6) the deleted Dexie upgrade steps used to run.
 */
function toBackupDocument(
  stores: Record<string, unknown[]>,
  fromVersion: number,
  savedAt: string
): Record<string, unknown> {
  if (fromVersion >= MIN_UPGRADABLE_VERSION) {
    const tables: Record<string, unknown[]> = { ...emptyBackupTables() };
    for (const name of BACKUP_TABLE_NAMES) tables[name] = stores[name] ?? [];
    return {
      format: BACKUP_FORMAT,
      format_version: 6,
      exported_at: savedAt,
      source_user_key: null,
      settings: null,
      tables,
      media: [],
    };
  }
  return { activityGroups: [], ...stores, version: 4, exportedAt: savedAt };
}

function deleteDatabase(name: string): Promise<void> {
  // A tab still running an old build may hold the database open. Dexie closes
  // on `versionchange`, so a block normally clears itself; if it does not, the
  // request stays queued and resolves once that tab closes.
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      console.warn("[recovery] waiting for other Upwards tabs to close");
  });
}

async function withRecoveryStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const req = indexedDB.open(RECOVERY_DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(RECOVERY_STORE);
  const idb = await request(req);
  try {
    const tx = idb.transaction(RECOVERY_STORE, mode);
    const result = await request(run(tx.objectStore(RECOVERY_STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    idb.close();
  }
}

export async function loadRecoveryBundles(): Promise<RecoveryBundle[]> {
  if (typeof indexedDB === "undefined") return [];
  const values = await withRecoveryStore("readonly", (store) => store.getAll());
  return values as RecoveryBundle[];
}

/** Keyed by `saved_at`, so a second reset never overwrites an unimported bundle. */
export async function saveRecoveryBundle(
  bundle: RecoveryBundle
): Promise<void> {
  await withRecoveryStore("readwrite", (store) =>
    store.put(bundle, bundle.saved_at)
  );
}

export async function deleteRecoveryBundle(savedAt: string): Promise<void> {
  await withRecoveryStore("readwrite", (store) => store.delete(savedAt));
}

/**
 * Runs before anything opens Dexie. Returns the bundle it saved, or null when
 * the local database opens as is. Throws, leaving the database untouched, if
 * the bundle could not be saved: deleting first would lose the rows.
 */
export async function prepareLocalDatabase(): Promise<RecoveryBundle | null> {
  if (typeof indexedDB === "undefined") return null;
  const idb = await openExisting(LOCAL_DB_NAME);
  if (!idb) return null;

  let bundle: RecoveryBundle | null = null;
  try {
    // Dexie stores its version times ten.
    const fromVersion = Math.floor(idb.version / 10);
    const lastUserId = loadLastSignedInUserId();
    const oldSchema = fromVersion < MIN_UPGRADABLE_VERSION;
    const unowned =
      !oldSchema &&
      isSupabaseConfigured &&
      !lastUserId &&
      (await countUserRows(idb)) > 0;
    if (!oldSchema && !unowned) return null;

    const stores = await readStores(idb, [...idb.objectStoreNames]);
    const hasRows = USER_STORES.some((name) => (stores[name]?.length ?? 0) > 0);
    if (hasRows) {
      const savedAt = new Date().toISOString();
      bundle = {
        saved_at: savedAt,
        reason: oldSchema ? "old_schema" : "unowned_data",
        source_user_id: lastUserId,
        from_version: fromVersion,
        document: toBackupDocument(stores, fromVersion, savedAt),
        imported_at: null,
        last_error: null,
      };
      await saveRecoveryBundle(bundle);
    }
  } finally {
    idb.close();
  }

  await deleteDatabase(LOCAL_DB_NAME);
  // The next sync must bootstrap from the snapshot, not resume a cursor that
  // described the deleted rows.
  clearLastServerSyncAt();
  clearSyncProtocolV2();
  clearLastDataEpoch();
  return bundle;
}
