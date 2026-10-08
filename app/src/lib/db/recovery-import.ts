import { getCachedUserId } from "@/lib/supabase";
import { syncEngine } from "@/lib/sync";
import { logError } from "@/lib/error-utils";
import {
  BackupImportBlockedError,
  importBackupJson,
} from "@/lib/backup/import";
import {
  deleteRecoveryBundle,
  loadRecoveryBundles,
  saveRecoveryBundle,
  type RecoveryBundle,
} from "./recovery";

export type RecoveryImportOutcome =
  | "imported"
  | "blocked"
  | "skipped"
  | "failed";

const listeners = new Set<() => void>();
let running = false;
let autoImportDone = false;

export function onRecoveryBundlesChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Imports one recovery bundle into the signed-in account.
 *
 * Without `savedAt`, picks the oldest unimported bundle the signed-in account
 * owned: the automatic path. Data created signed out (or by another account)
 * only imports when the user picks it on Sync issues, because merging it
 * unasked could put one person's rows in another's account.
 */
export async function importRecoveryBundle(
  savedAt?: string
): Promise<RecoveryImportOutcome> {
  if (running) return "skipped";
  running = true;
  let bundle: RecoveryBundle | undefined;
  try {
    const userId = getCachedUserId();
    if (!userId) return "skipped";
    const pending = (await loadRecoveryBundles())
      .filter((b) => !b.imported_at)
      .sort((a, b) => a.saved_at.localeCompare(b.saved_at));
    bundle = savedAt
      ? pending.find((b) => b.saved_at === savedAt)
      : pending.find((b) => b.source_user_id === userId && !b.last_error);
    if (!bundle) {
      if (!savedAt) autoImportDone = true;
      return "skipped";
    }

    await importBackupJson(bundle.document);
    await saveRecoveryBundle({
      ...bundle,
      imported_at: new Date().toISOString(),
      last_error: null,
    });
    return "imported";
  } catch (err) {
    if (err instanceof BackupImportBlockedError) return "blocked";
    logError("Recovery bundle import failed", err);
    if (bundle) {
      await saveRecoveryBundle({
        ...bundle,
        last_error: err instanceof Error ? err.message : String(err),
      }).catch(() => undefined);
    }
    return "failed";
  } finally {
    running = false;
    notify();
  }
}

export async function removeRecoveryBundle(savedAt: string): Promise<void> {
  await deleteRecoveryBundle(savedAt);
  notify();
}

/** After each clean sync, import owned bundles until none are left. */
export function startRecoveryAutoImport(): () => void {
  return syncEngine.subscribe((state) => {
    if (autoImportDone || running) return;
    if (state.isSyncing || !state.lastSyncAt || state.lastError) return;
    void importRecoveryBundle();
  });
}
