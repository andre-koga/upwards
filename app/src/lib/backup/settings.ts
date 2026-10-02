import i18n from "@/lib/i18n";
import { now } from "@/lib/db";
import {
  getStoredLocale,
  isLocaleValue,
  setStoredLocale,
} from "@/lib/i18n/locale-storage";
import { getCachedUserId, supabase } from "@/lib/supabase";
import type { BackupSettings } from "./format";

export function readBackupSettings(): BackupSettings {
  return { locale: getStoredLocale() };
}

/**
 * Restore settings this device has not chosen yet. Like the rest of the
 * import, a backup fills gaps and never replaces a choice already made here.
 */
export async function applyBackupSettings(
  settings: BackupSettings | null
): Promise<void> {
  const locale = settings?.locale;
  if (!locale || !isLocaleValue(locale) || getStoredLocale()) return;
  setStoredLocale(locale);
  await i18n.changeLanguage(locale);
  const userId = getCachedUserId();
  if (supabase && userId) {
    await supabase
      .from("user_profiles")
      .upsert(
        { user_id: userId, locale, updated_at: now() },
        { onConflict: "user_id" }
      );
  }
}
