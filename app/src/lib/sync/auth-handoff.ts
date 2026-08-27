import { syncEngine } from "./index";
import {
  clearLocalSyncData,
  hasLocalSyncableData,
} from "./clear-local-sync-data";
import {
  loadLastSignedInUserId,
  saveLastSignedInUserId,
  clearLastSignedInUserId,
} from "./sync-storage";
import { getLocalSyncSafetyStatus } from "./unsynced-data";
import { rekeyLocalRowsToCurrentUser } from "./identity-repair";

export type PrepareResult =
  | "ready"
  | "needs_guest_choice"
  | "needs_account_switch_choice";
export type GuestHandoffChoice = "upload_local" | "use_cloud";

/**
 * Called on SIGNED_IN / INITIAL_SESSION before starting auto-sync.
 *
 * - Account switch with unsynced local data → "needs_account_switch_choice".
 * - Account switch with everything synced → wipe local and return "ready".
 * - Returning user (same userId) → return "ready" immediately.
 * - First-time sign-in with existing guest data → return "needs_guest_choice"
 *   so the UI can ask whether to upload or replace.
 */
export async function prepareSignedInSession(
  userId: string
): Promise<PrepareResult> {
  const lastUserId = loadLastSignedInUserId();

  if (lastUserId && lastUserId !== userId) {
    // Different account on this device. This used to wipe unconditionally, with a
    // comment saying the caller "should have pushed" and nothing enforcing it.
    // Nothing does: this runs from an onAuthStateChange callback, which fires on
    // token refresh and app boot, not just after a deliberate sign-out. So a
    // rejected or never-pushed row plus the whole op queue could be destroyed with
    // no prompt and no way back.
    const safety = await getLocalSyncSafetyStatus();
    if (safety.hasUnsyncedData) {
      // The user decides. Deliberately does not start auto-sync: pulling the new
      // account's data on top of the previous account's unsynced rows would mix
      // two accounts' data in one local database.
      return "needs_account_switch_choice";
    }

    await clearLocalSyncData();
    clearLastSignedInUserId();
    saveLastSignedInUserId(userId);
    return "ready";
  }

  if (!lastUserId) {
    // Never been signed in on this device.
    const hasData = await hasLocalSyncableData();
    if (hasData) {
      // Guest user with local data: block sync until they decide.
      return "needs_guest_choice";
    }
  }

  // Returning user with empty local (or just pulled) — go straight to sync.
  saveLastSignedInUserId(userId);
  return "ready";
}

/**
 * Called once the guest-handoff dialog has a confirmed choice.
 *
 * upload_local: re-key the guest rows onto the signed-in user's natural IDs, then
 *               push them and run normal sync.
 * use_cloud:    wipe local first, then pull from cloud.
 */
export async function completeGuestHandoff(
  userId: string,
  choice: GuestHandoffChoice
): Promise<void> {
  if (choice === "use_cloud") {
    await clearLocalSyncData();
  } else {
    // Must happen before the first push. Guest rows carry natural IDs derived from
    // `guest:<deviceId>`, which no signed-in device recomputes, so pushing them
    // unchanged seeds a duplicate for every date the user later touches while
    // signed in.
    await rekeyLocalRowsToCurrentUser();
  }
  saveLastSignedInUserId(userId);
  syncEngine.startAutoSync(60_000, userId);
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
