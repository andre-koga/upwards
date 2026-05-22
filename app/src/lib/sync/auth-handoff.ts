import { syncEngine } from "./index";
import { clearLocalSyncData, hasLocalSyncableData } from "./clear-local-sync-data";
import {
  loadLastSignedInUserId,
  saveLastSignedInUserId,
  clearLastSignedInUserId,
} from "./sync-storage";

export type PrepareResult = "ready" | "needs_guest_choice";
export type GuestHandoffChoice = "upload_local" | "use_cloud";

/**
 * Called on SIGNED_IN / INITIAL_SESSION before starting auto-sync.
 *
 * - Account switch detected → wipe local and return "ready" (pull from cloud).
 * - Returning user (same userId) → return "ready" immediately.
 * - First-time sign-in with existing guest data → return "needs_guest_choice"
 *   so the UI can ask whether to upload or replace.
 */
export async function prepareSignedInSession(
  userId: string
): Promise<PrepareResult> {
  const lastUserId = loadLastSignedInUserId();

  if (lastUserId && lastUserId !== userId) {
    // Different account on this device — wipe the previous user's local data.
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
 * upload_local: push existing data to the new account, then run normal sync.
 * use_cloud:    wipe local first, then pull from cloud.
 */
export async function completeGuestHandoff(
  userId: string,
  choice: GuestHandoffChoice
): Promise<void> {
  if (choice === "use_cloud") {
    await clearLocalSyncData();
  }
  saveLastSignedInUserId(userId);
  syncEngine.startAutoSync(60_000);
}
