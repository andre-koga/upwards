/**
 * Diagnostics only (blank-account investigation). A plain-text snapshot of what
 * this device holds, so a blank screen can be told apart from an empty local
 * database: row counts per table, the live (not deleted) journal and activity
 * rows, the sync flags kept in localStorage, and storage/PWA state. It carries
 * no content from entries and no tokens. Remove with `breadcrumbs.ts` once the
 * cause is known.
 */
import { db } from "@/lib/db";
import { readBreadcrumbs } from "@/lib/breadcrumbs";

async function attempt<T>(read: () => Promise<T>): Promise<T | string> {
  try {
    return await read();
  } catch (error) {
    return `read failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
  }
}

function localDay(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Sync flags only; the account id is cut to its first eight characters. */
function syncFlags(): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("okhabit_")) continue;
    const value = localStorage.getItem(key) ?? "";
    flags[key] = key.includes("user_id") ? `${value.slice(0, 8)}...` : value;
  }
  return flags;
}

async function storageState() {
  if (!navigator.storage) return "unavailable";
  const [persisted, estimate] = await Promise.all([
    attempt(() => navigator.storage.persisted()),
    attempt(() => navigator.storage.estimate()),
  ]);
  return { persisted, estimate };
}

export async function collectDeviceReport(): Promise<string> {
  const today = localDay();
  const tables = Object.fromEntries(
    await Promise.all(
      db.tables.map(
        async (table) =>
          [table.name, await attempt(() => table.count())] as const
      )
    )
  );

  const journal = await attempt(async () => {
    const rows = await db.journalEntries.toArray();
    const live = rows.filter((row) => !row.deleted_at);
    const dates = live.map((row) => row.entry_date).sort();
    return {
      total: rows.length,
      live: live.length,
      oldest: dates[0] ?? null,
      newest: dates[dates.length - 1] ?? null,
    };
  });

  const activities = await attempt(async () => {
    const rows = await db.activities.toArray();
    return {
      total: rows.length,
      live: rows.filter((row) => !row.deleted_at && !row.archived_at).length,
    };
  });

  const todayRows = await attempt(() =>
    db.dailyEntries.where("date").equals(today).count()
  );

  const report = {
    at: new Date().toISOString(),
    today,
    online: navigator.onLine,
    standalone: matchMedia("(display-mode: standalone)").matches,
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    appVersion: import.meta.env.VITE_APP_VERSION ?? null,
    db: { open: db.isOpen(), version: db.verno },
    tables,
    journal,
    activities,
    dailyEntriesToday: todayRows,
    syncFlags: syncFlags(),
    storage: await storageState(),
    breadcrumbs: readBreadcrumbs(),
  };
  return JSON.stringify(report, null, 2);
}
