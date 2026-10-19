/**
 * Diagnostics only (blank-account investigation). A small ring buffer in
 * localStorage, because Error logs and Sync issues live in the same IndexedDB
 * whose failure we are trying to explain. Remove once the cause is known.
 */
import { db } from "@/lib/db";
import {
  loadLastAppliedSequence,
  loadLastSignedInUserId,
  loadSyncProtocolV2,
} from "@/lib/sync/sync-storage";

const KEY = "upwards:breadcrumbs";
const MAX_ENTRIES = 40;

export interface Breadcrumb {
  at: string;
  event: string;
  detail?: Record<string, unknown>;
}

export function readBreadcrumbs(): Breadcrumb[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Breadcrumb[]) : [];
  } catch {
    return [];
  }
}

export function recordBreadcrumb(
  event: string,
  detail?: Record<string, unknown>
): void {
  try {
    const next = [
      ...readBreadcrumbs(),
      { at: new Date().toISOString(), event, detail },
    ].slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: a breadcrumb must never break the app.
  }
}

export function clearBreadcrumbs(): void {
  localStorage.removeItem(KEY);
}

async function countRows(): Promise<number> {
  const counts = await Promise.all([
    db.activityGroups.count(),
    db.activities.count(),
    db.dailyEntries.count(),
    db.activityPeriods.count(),
    db.journalEntries.count(),
    db.memories.count(),
    db.oneTimeTasks.count(),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * What the device looked like: local rows against the sync flags kept in
 * localStorage. Zero rows with a sync cursor means the data vanished under a
 * device that thinks it is synced; zero rows without one means a download is
 * still pending; a read error means the database itself failed.
 */
export async function recordDeviceState(
  event: "boot" | "resume"
): Promise<void> {
  const flags = {
    syncCursor: loadLastAppliedSequence(),
    protocolV2: loadSyncProtocolV2(),
    knowsUser: loadLastSignedInUserId() !== null,
    online: navigator.onLine,
  };
  try {
    const rows = await countRows();
    // Resumes are routine; only the empty one is worth a line.
    if (event === "resume" && rows > 0) return;
    recordBreadcrumb(event, { rows, ...flags });
  } catch (error) {
    recordBreadcrumb(`${event}.read_failed`, {
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
      ...flags,
    });
  }
}
