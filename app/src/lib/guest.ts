import { useEffect, useState } from "react";
import { isYouMode } from "@/lib/app-mode";
import { authStorageKey, hasStoredSession } from "@/lib/auth-gate";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Only the session this build's Supabase project wrote counts. */
const SESSION_STORAGE_KEY = authStorageKey(import.meta.env.VITE_SUPABASE_URL);

/**
 * Whether this device is being used without an account. Only the portrait site
 * allows it: there, someone who never signed in keeps their test and answers on
 * the device. The full app always asks for an account first.
 *
 * "Has a session on file" counts as signed in even when it cannot be confirmed
 * right now (offline), the same rule the sign-in gate follows.
 */
export function isGuestDevice(): boolean {
  return (
    isYouMode &&
    isSupabaseConfigured &&
    !hasStoredSession(window.localStorage, SESSION_STORAGE_KEY)
  );
}

/** Re-reads `isGuestDevice` when someone signs in or out. */
export function useIsGuest(): boolean {
  const [guest, setGuest] = useState(isGuestDevice);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() =>
      setGuest(isGuestDevice())
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return guest;
}
