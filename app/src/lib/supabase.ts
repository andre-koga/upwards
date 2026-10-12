import { createClient, type Session } from "@supabase/supabase-js";
import { authStorageKey, storedSessionUserId } from "@/lib/auth-gate";
import { fetchWithTimeout } from "@/lib/supabase-fetch";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isLocalSupabaseUrl =
  typeof supabaseUrl === "string" &&
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(supabaseUrl);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      global: { fetch: fetchWithTimeout },
    })
  : null;

// ─── Reactive session cache ───────────────────────────────────────────────────
// We keep a synchronous cache updated by onAuthStateChange so that the sync
// engine never needs to make a network call just to read the current user.

let _cachedSession: Session | null = null;

if (supabase) {
  const isNetworkAuthError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes("networkerror") ||
      message.includes("failed to fetch") ||
      message.includes("cors request did not succeed")
    );
  };

  const clearInvalidSession = async () => {
    _cachedSession = null;
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore; clearing local cache is sufficient fallback
    }
  };

  const validateSession = async (session: Session | null) => {
    if (!session) {
      _cachedSession = null;
      return;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // In local-dev setups, a stopped Supabase instance can leave a stale refresh
      // token in storage and trigger repeated lock/refresh network errors.
      // Clearing the local auth state stops the retry loop immediately.
      if (isLocalSupabaseUrl && isNetworkAuthError(error)) {
        await clearInvalidSession();
        return;
      }

      // For transient non-local failures (e.g. brief mobile wake/background), keep
      // the local session and rely on future auth events to reconcile.
      _cachedSession = session;
      return;
    }

    if (!data.user || data.user.id !== session.user.id) {
      await clearInvalidSession();
      return;
    }

    _cachedSession = session;
  };

  // Populate cache immediately from storage (no network round-trip needed)
  supabase.auth.getSession().then(({ data }) => {
    _cachedSession = data.session ?? null;
    void validateSession(data.session ?? null);
  });

  // Stay up to date reactively — prime cache synchronously so sync can run on reload.
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedSession = session;
    void validateSession(session);
  });
}

/** Synchronous – returns the cached user id or null. */
export function getCachedUserId(): string | null {
  return _cachedSession?.user?.id ?? null;
}

/**
 * The account to record an offline edit against. This is the confirmed user
 * when there is one, else the account in this project's stored session record.
 *
 * Edits made while supabase-js has not yet confirmed the session (offline after
 * a long gap, or a refresh that keeps failing) must still be queued. Dropping
 * them leaves rows marked unsynced with no operation behind them, which nothing
 * ever pushes. Queued under the stored account, they go out as soon as the
 * session is confirmed, and the server checks the account against the token.
 */
export function getQueueAccountId(): string | null {
  const confirmed = getCachedUserId();
  if (confirmed) return confirmed;
  if (!isSupabaseConfigured || typeof localStorage === "undefined") return null;
  return storedSessionUserId(localStorage, authStorageKey(supabaseUrl));
}

/** Synchronous – returns the cached session or null. */
export function getCachedSession(): Session | null {
  return _cachedSession;
}
