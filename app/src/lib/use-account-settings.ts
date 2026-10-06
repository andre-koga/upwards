import { useEffect, useSyncExternalStore } from "react";
import { db } from "@/lib/db";
import { getCachedUserId, supabase } from "@/lib/supabase";
import {
  ACCOUNT_SETTINGS_COLUMNS,
  adoptRemoteAccountSettings,
  getAccountSettings,
  subscribeAccountSettings,
  updateAccountSettings,
  type AccountSettings,
  type AccountSettingsRow,
} from "@/lib/account-settings";

/** Live account settings; re-renders when a toggle changes on this device. */
export function useAccountSettings(): AccountSettings {
  return useSyncExternalStore(
    subscribeAccountSettings,
    getAccountSettings,
    getAccountSettings
  );
}

/**
 * An account that has never chosen a daily clip setting but already has clips
 * keeps seeing them: hiding recorded video by default would look like data loss.
 * New accounts stay off until they opt in.
 */
export async function inferDailyClip(): Promise<void> {
  if (getAccountSettings().dailyClip !== null) return;
  const hasClip = await db.journalEntries
    .filter((entry) => !entry.deleted_at && Boolean(entry.video_path?.trim()))
    .first();
  if (hasClip) updateAccountSettings({ dailyClip: true });
}

async function loadFromAccount(): Promise<void> {
  const userId = getCachedUserId();
  if (!supabase || !userId) return;
  const { data, error } = await supabase
    .from("user_profiles")
    .select(ACCOUNT_SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[account-settings] load failed", error.message);
    return;
  }
  await adoptRemoteAccountSettings(data as Partial<AccountSettingsRow> | null);
  await inferDailyClip();
}

/**
 * Mount once near the app root. Pulls the account's settings when a session
 * starts and when the app returns to the foreground, so a change made on
 * another device shows up here without a reload.
 */
export function useAccountSettingsSync(): void {
  useEffect(() => {
    if (!supabase) return;

    void loadFromAccount();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        void loadFromAccount();
      }
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadFromAccount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
