import i18n from "@/lib/i18n";
import { now } from "@/lib/db";
import {
  getStoredLocale,
  isLocaleValue,
  setStoredLocale,
} from "@/lib/i18n/locale-storage";
import { getCachedUserId, supabase } from "@/lib/supabase";
import {
  getAccountSettings,
  updateAccountSettings,
  type AccountSettings,
} from "@/lib/account-settings";
import type { BackupSettings } from "./format";

export function readBackupSettings(): BackupSettings {
  const account = getAccountSettings();
  return {
    locale: getStoredLocale(),
    dailyClip: account.dailyClip,
    holidayCalendars: account.holidayCalendars,
    hemisphere: account.hemisphere,
  };
}

/** Account choices this device has not made yet; existing choices are kept. */
function missingAccountSettings(
  settings: BackupSettings
): Partial<AccountSettings> {
  const current = getAccountSettings();
  const fill: Partial<AccountSettings> = {};
  if (current.dailyClip === null && typeof settings.dailyClip === "boolean")
    fill.dailyClip = settings.dailyClip;
  if (
    current.holidayCalendars === null &&
    Array.isArray(settings.holidayCalendars)
  )
    fill.holidayCalendars = settings.holidayCalendars;
  if (
    current.hemisphere === null &&
    (settings.hemisphere === "north" || settings.hemisphere === "south")
  )
    fill.hemisphere = settings.hemisphere;
  return fill;
}

/**
 * Restore settings this device has not chosen yet. Like the rest of the
 * import, a backup fills gaps and never replaces a choice already made here.
 */
export async function applyBackupSettings(
  settings: BackupSettings | null
): Promise<void> {
  if (settings) {
    const fill = missingAccountSettings(settings);
    if (Object.keys(fill).length > 0) updateAccountSettings(fill);
  }
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
