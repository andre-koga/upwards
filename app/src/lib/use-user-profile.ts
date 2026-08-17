import { useCallback, useEffect, useState } from "react";
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
  locale: LocaleValue;
  loading: boolean;
  error: string | null;
}

export function useUserProfile() {
  // Reactive user id — getCachedUserId() alone is not enough on reload because
  // the session cache is filled asynchronously after validateSession().
  const [userId, setUserId] = useState<string | null>(() => getCachedUserId());

  const [state, setState] = useState<UserProfileState>({
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
        locale: resolveInitialLocale(),
        loading: Boolean(getCachedSession()),
        error: null,
      });
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("locale")
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
        locale,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load profile",
      }));
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setLocale,
  };
}
