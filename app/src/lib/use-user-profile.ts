import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase, getCachedUserId, getCachedSession } from "@/lib/supabase";
import { now } from "@/lib/db";
import {
  getStoredLocale,
  isLocaleValue,
  resolveInitialLocale,
  setStoredLocale,
  type LocaleValue,
} from "@/lib/i18n/locale-storage";
import i18n from "@/lib/i18n";

interface UserProfileState {
  username: string | null;
  displayName: string | null;
  locale: LocaleValue;
  loading: boolean;
  error: string | null;
}

export function useUserProfile() {
  // Reactive user id — getCachedUserId() alone is not enough on reload because
  // the session cache is filled asynchronously after validateSession().
  const [userId, setUserId] = useState<string | null>(() => getCachedUserId());

  const { t } = useTranslation("settings");

  const [state, setState] = useState<UserProfileState>({
    username: null,
    displayName: null,
    locale: resolveInitialLocale(),
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!supabase) return;

    const syncUserId = () => setUserId(getCachedUserId());

    syncUserId();
    void supabase.auth.getSession().then(() => syncUserId());

    const { data } = supabase.auth.onAuthStateChange(() => {
      syncUserId();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setState({
        username: null,
        displayName: null,
        locale: resolveInitialLocale(),
        loading: Boolean(getCachedSession()),
        error: null,
      });
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("username, display_name, locale")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      // Sign-in merge: adopt the synced locale if one exists; otherwise push
      // whatever this device already had (guest pick) up to the account.
      const remoteLocale = data?.locale as string | null | undefined;
      let locale: LocaleValue;
      if (remoteLocale && isLocaleValue(remoteLocale)) {
        locale = remoteLocale;
        setStoredLocale(locale);
        void i18n.changeLanguage(locale);
      } else {
        const deviceLocale = getStoredLocale();
        locale = deviceLocale ?? resolveInitialLocale();
        if (deviceLocale) {
          void supabase
            .from("user_profiles")
            .upsert(
              { user_id: userId, locale: deviceLocale, updated_at: now() },
              { onConflict: "user_id" }
            );
        }
      }

      setState({
        username: (data?.username as string | null) ?? null,
        displayName: (data?.display_name as string | null) ?? null,
        locale,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : t("profile.loadFailed"),
      }));
    }
  }, [userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const setUsername = useCallback(
    async (username: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: t("profile.notSignedIn") };
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return { error: t("profile.usernameInvalid") };
      }
      try {
        const { error } = await supabase.from("user_profiles").upsert(
          {
            user_id: userId,
            username,
            updated_at: now(),
          },
          { onConflict: "user_id" }
        );
        if (error) {
          if (error.code === "23505") {
            return { error: t("profile.usernameTaken") };
          }
          throw error;
        }
        setState((s) => ({ ...s, username, error: null }));
        return { error: null };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : t("profile.usernameSaveFailed");
        setState((s) => ({ ...s, error: msg }));
        return { error: msg };
      }
    },
    [userId, t]
  );

  const setDisplayName = useCallback(
    async (displayName: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: t("profile.notSignedIn") };
      try {
        const { error } = await supabase
          .from("user_profiles")
          .upsert(
            { user_id: userId, display_name: displayName, updated_at: now() },
            { onConflict: "user_id" }
          );
        if (error) throw error;
        setState((s) => ({ ...s, displayName, error: null }));
        return { error: null };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : t("profile.displayNameSaveFailed");
        return { error: msg };
      }
    },
    [userId, t]
  );

  const setLocale = useCallback(
    (locale: LocaleValue) => {
      setStoredLocale(locale);
      void i18n.changeLanguage(locale);
      setState((s) => ({ ...s, locale }));
      if (supabase && userId) {
        void supabase
          .from("user_profiles")
          .upsert(
            { user_id: userId, locale, updated_at: now() },
            { onConflict: "user_id" }
          );
      }
    },
    [userId]
  );

  return {
    ...state,
    reload: load,
    setUsername,
    setDisplayName,
    setLocale,
  };
}

/** Look up a user by exact username. Returns null if not found.
 *  No prefix search — privacy-preserving. */
export async function lookupUserByUsername(username: string): Promise<{
  user_id: string;
  username: string;
  display_name: string | null;
} | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("lookup_user_by_username", {
    exact_username: username,
  });
  if (error || !data || (data as unknown[]).length === 0) return null;
  const row = (
    data as Array<{
      user_id: string;
      username: string;
      display_name: string | null;
    }>
  )[0];
  return row ?? null;
}
