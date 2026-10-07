import { getCachedUserId, supabase } from "@/lib/supabase";
import { now } from "@/lib/db";
import { parseBirthday } from "@/lib/holidays/birthday";

/**
 * Account-level opt-ins (product-scope.md §2.5, §2.7, §2.8). They follow the
 * account across devices through the `user_profiles` row, and are cached in
 * localStorage so they work offline and before the first sync.
 *
 * `null` means "never chosen", which is not the same as "off": a device may
 * infer a sensible default once (see `useAccountSettingsSync`), but an explicit
 * `false` is always respected.
 */
export type Hemisphere = "north" | "south";

export interface AccountSettings {
  autoLocation: boolean | null;
  dailyClip: boolean | null;
  holidayCalendars: string[] | null;
  hemisphere: Hemisphere | null;
  /** Your own birth date, `YYYY-MM-DD`. Personal data: never sent to the AI. */
  birthday: string | null;
}

export const EMPTY_ACCOUNT_SETTINGS: AccountSettings = {
  autoLocation: null,
  dailyClip: null,
  holidayCalendars: null,
  hemisphere: null,
  birthday: null,
};

const STORAGE_KEY = "upwards-account-settings";

/** The `user_profiles` columns, as the server names them. */
export interface AccountSettingsRow {
  auto_location: boolean | null;
  daily_clip: boolean | null;
  holiday_calendars: string[] | null;
  hemisphere: Hemisphere | null;
  birthday: string | null;
}

export const ACCOUNT_SETTINGS_COLUMNS =
  "auto_location,daily_clip,holiday_calendars,hemisphere,birthday";

export function toRow(
  settings: Partial<AccountSettings>
): Partial<AccountSettingsRow> {
  const row: Partial<AccountSettingsRow> = {};
  if (settings.autoLocation !== undefined)
    row.auto_location = settings.autoLocation;
  if (settings.dailyClip !== undefined) row.daily_clip = settings.dailyClip;
  if (settings.holidayCalendars !== undefined)
    row.holiday_calendars = settings.holidayCalendars;
  if (settings.hemisphere !== undefined) row.hemisphere = settings.hemisphere;
  if (settings.birthday !== undefined) row.birthday = settings.birthday;
  return row;
}

function fromRow(row: Partial<AccountSettingsRow> | null): AccountSettings {
  return {
    autoLocation:
      typeof row?.auto_location === "boolean" ? row.auto_location : null,
    dailyClip: typeof row?.daily_clip === "boolean" ? row.daily_clip : null,
    holidayCalendars: Array.isArray(row?.holiday_calendars)
      ? row.holiday_calendars.filter((c) => typeof c === "string")
      : null,
    hemisphere:
      row?.hemisphere === "north" || row?.hemisphere === "south"
        ? row.hemisphere
        : null,
    // Only a real calendar date counts; anything else is treated as not set.
    birthday: parseBirthday(row?.birthday) ? (row?.birthday ?? null) : null,
  };
}

/**
 * Combine this device's cached settings with the account's. A choice made on
 * the account wins; a choice only this device has made is pushed up, so a
 * setting picked offline or before sign-in is not lost.
 */
export function mergeAccountSettings(
  local: AccountSettings,
  remote: AccountSettings
): { merged: AccountSettings; pushUp: Partial<AccountSettings> } {
  const merged: AccountSettings = { ...remote };
  const pushUp: Partial<AccountSettings> = {};
  for (const key of Object.keys(EMPTY_ACCOUNT_SETTINGS) as Array<
    keyof AccountSettings
  >) {
    if (remote[key] === null && local[key] !== null) {
      // Assigned through a typed helper so each key keeps its own type.
      Object.assign(merged, { [key]: local[key] });
      Object.assign(pushUp, { [key]: local[key] });
    }
  }
  return { merged, pushUp };
}

function read(): AccountSettings {
  if (typeof localStorage === "undefined") return EMPTY_ACCOUNT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_ACCOUNT_SETTINGS;
    return fromRow(toRow(JSON.parse(raw) as AccountSettings));
  } catch {
    return EMPTY_ACCOUNT_SETTINGS;
  }
}

let snapshot: AccountSettings = read();
const listeners = new Set<() => void>();

function commit(next: AccountSettings) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the in-memory value still applies this session.
  }
  for (const listener of listeners) listener();
}

export function getAccountSettings(): AccountSettings {
  return snapshot;
}

export function subscribeAccountSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function pushToProfile(patch: Partial<AccountSettings>): Promise<void> {
  const userId = getCachedUserId();
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, ...toRow(patch), updated_at: now() },
      { onConflict: "user_id" }
    );
  if (error) console.error("[account-settings] push failed", error.message);
}

/** Change settings on this device now; the account catches up when it can. */
export function updateAccountSettings(patch: Partial<AccountSettings>): void {
  commit({ ...snapshot, ...patch });
  void pushToProfile(patch);
}

/** Adopt the account's row after sign-in or on reload. */
export async function adoptRemoteAccountSettings(
  row: Partial<AccountSettingsRow> | null
): Promise<void> {
  const { merged, pushUp } = mergeAccountSettings(snapshot, fromRow(row));
  commit(merged);
  if (Object.keys(pushUp).length > 0) await pushToProfile(pushUp);
}

/** Forget this device's copy, e.g. on sign-out or switching accounts. */
export function clearAccountSettings(): void {
  commit(EMPTY_ACCOUNT_SETTINGS);
}

export const isAutoLocationOn = (): boolean => snapshot.autoLocation === true;
export const isDailyClipOn = (): boolean => snapshot.dailyClip === true;
