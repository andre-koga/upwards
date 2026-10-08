import { syncEngine } from "./index";
import { clearLocalSyncData } from "./clear-local-sync-data";
import {
  loadLastSignedInUserId,
  saveLastSignedInUserId,
  clearLastSignedInUserId,
} from "./sync-storage";
import { getLocalSyncSafetyStatus } from "./unsynced-data";

export type PrepareResult = "ready" | "needs_account_switch_choice";

/**
 * Called on SIGNED_IN / INITIAL_SESSION before starting auto-sync.
 *
 * - Account switch with unsynced local data → "needs_account_switch_choice".
 * - Account switch with everything synced → wipe local and return "ready".
 * - Same account, or first sign-in on this device → "ready".
 *
 * Data created signed out never reaches here: `prepareLocalDatabase()` moves
 * it into the recovery bundle before Dexie opens.
 */
export async function prepareSignedInSession(
  userId: string
): Promise<PrepareResult> {
  const lastUserId = loadLastSignedInUserId();

  if (lastUserId && lastUserId !== userId) {
    // This runs from an onAuthStateChange callback, which fires on token
    // refresh and app boot, not just after a deliberate sign-out. Wiping here
    // without asking could destroy rejected or never-pushed rows plus the
    // whole op queue with no way back.
    const safety = await getLocalSyncSafetyStatus();
    if (safety.hasUnsyncedData) {
      // The user decides. Deliberately does not start auto-sync: pulling the new
      // account's data on top of the previous account's unsynced rows would mix
      // two accounts' data in one local database.
      return "needs_account_switch_choice";
    }

    await clearLocalSyncData();
    clearLastSignedInUserId();
  }

  saveLastSignedInUserId(userId);
  return "ready";
}

/**
 * Called once the user confirms discarding the previous account's unsynced data.
 *
 * The only other option offered is to sign out and sign back in as the previous
 * account, which needs no work here: leaving the local data untouched is exactly
 * what makes that recovery possible.
 */
export async function discardPreviousAccountData(
  userId: string
): Promise<void> {
  await clearLocalSyncData();
  clearLastSignedInUserId();
  saveLastSignedInUserId(userId);
  syncEngine.startAutoSync(60_000, userId);
}

type AccountSwitchListener = (userId: string) => void;
const accountSwitchListeners = new Set<AccountSwitchListener>();

/** Lets main.tsx (outside React) ask the tree for the account-switch dialog. */
export function onAccountSwitchChoiceNeeded(
  listener: AccountSwitchListener
): () => void {
  accountSwitchListeners.add(listener);
  return () => accountSwitchListeners.delete(listener);
}

export function emitAccountSwitchChoiceNeeded(userId: string): void {
  accountSwitchListeners.forEach((listener) => listener(userId));
}
