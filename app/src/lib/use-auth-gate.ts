import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  hasStoredSession,
  initialGateState,
  isEmailLinkUrl,
  nextGateState,
  type AuthEventName,
  type GateState,
} from "@/lib/auth-gate";

/** An email link that never turns into a session must not trap the screen. */
const LOADING_TIMEOUT_MS = 8_000;

export function useAuthGate(): GateState {
  const [state, setState] = useState<GateState>(() =>
    initialGateState({
      configured: isSupabaseConfigured,
      hasStoredSession: hasStoredSession(window.localStorage),
      arrivingFromEmailLink: isEmailLinkUrl(window.location),
    })
  );

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState((current) =>
        nextGateState(
          current,
          event as AuthEventName,
          Boolean(session),
          hasStoredSession(window.localStorage)
        )
      );
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state !== "loading") return;
    const timer = window.setTimeout(
      () =>
        setState((current) => (current === "loading" ? "signed_out" : current)),
      LOADING_TIMEOUT_MS
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  return state;
}
