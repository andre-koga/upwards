import { db } from "./index";

/**
 * Whether this device's database (IndexedDB) still answers.
 *
 * iOS can stop answering IndexedDB requests for the app, for example when a
 * suspended or replaced instance of it still holds a transaction. Nothing
 * errors: reads and writes just never finish, so Today keeps loading, a sync
 * never ends, and Error logs (stored in the same database) stay empty. This
 * module notices that and says so, which nothing else can.
 */

export type LocalDatabaseHealth = "unknown" | "ok" | "stalled";

export const PROBE_TIMEOUT_MS = 8_000;
const STALLED_RECHECK_MS = 15_000;
/** A sync that runs this long gets the database checked. */
export const LONG_SYNC_MS = 30_000;
/** Survives a restart: while the database is stuck it can't hold this itself. */
export const STALL_MARKER_KEY = "upwards:local-db-stalled-since";

type Listener = (health: LocalDatabaseHealth) => void;

let health: LocalDatabaseHealth = "unknown";
let probeInFlight: Promise<boolean> | null = null;
let recheckTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

export function getLocalDatabaseHealth(): LocalDatabaseHealth {
  return health;
}

export function subscribeLocalDatabaseHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setHealth(next: LocalDatabaseHealth): void {
  if (next === health) return;
  health = next;
  listeners.forEach((listener) => listener(next));
}

/** One read across every table, so a store held by another connection counts. */
function readEveryTable(): Promise<boolean> {
  return db
    .transaction("r", db.tables, () =>
      Promise.all(db.tables.map((table) => table.count()))
    )
    .then(
      () => true,
      () => true
    );
}

function onStalled(): void {
  if (!localStorage.getItem(STALL_MARKER_KEY)) {
    localStorage.setItem(STALL_MARKER_KEY, new Date().toISOString());
  }
  setHealth("stalled");
  if (recheckTimer) clearTimeout(recheckTimer);
  recheckTimer = setTimeout(() => {
    recheckTimer = null;
    void checkLocalDatabase();
  }, STALLED_RECHECK_MS);
}

async function onAnswered(): Promise<void> {
  if (recheckTimer) {
    clearTimeout(recheckTimer);
    recheckTimer = null;
  }
  setHealth("ok");
  const since = localStorage.getItem(STALL_MARKER_KEY);
  if (!since) return;
  localStorage.removeItem(STALL_MARKER_KEY);
  const { logError } = await import("@/lib/error-utils");
  logError(
    "This device's storage stopped responding",
    new Error(
      `No answer from the local database from ${since} until ${new Date().toISOString()}.`
    )
  );
}

/**
 * Reads every table with a time limit. Returns whether the database answered.
 * A read that outlives the limit is not abandoned: if it finishes later, the
 * database is marked healthy again then.
 */
export async function checkLocalDatabase(
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return true;
  if (!probeInFlight) {
    const probe = readEveryTable();
    probeInFlight = probe;
    void probe.then(() => {
      probeInFlight = null;
      void onAnswered();
    });
  }
  const probe = probeInFlight;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const answered = await Promise.race([
    probe,
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  if (!answered) onStalled();
  return answered;
}

/** Test seam. */
export function resetLocalDatabaseHealthForTests(): void {
  health = "unknown";
  probeInFlight = null;
  if (recheckTimer) clearTimeout(recheckTimer);
  recheckTimer = null;
  listeners.clear();
}
