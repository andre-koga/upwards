import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getErrorMessage, isTransientNetworkError } from "@/lib/error-utils";

const CHECK_TIMEOUT_MS = 12_000;

export type ServerReach =
  | { ok: true }
  | {
      ok: false;
      reason: "offline" | "unreachable" | "timeout";
      detail: string;
    };

export type SessionRefresh =
  | { ok: true }
  | {
      ok: false;
      reason: "unreachable" | "timeout" | "rejected" | "other";
      detail: string;
    };

export interface SessionCheckResult {
  reach: ServerReach;
  refresh: SessionRefresh | null;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | "timeout"> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Whether this device can reach the Supabase server at all. */
export async function checkServerReach(): Promise<ServerReach> {
  if (!navigator.onLine) {
    return {
      ok: false,
      reason: "offline",
      detail: "navigator.onLine is false",
    };
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const response = await withTimeout(
      fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }),
      CHECK_TIMEOUT_MS
    );
    if (response === "timeout") {
      return { ok: false, reason: "timeout", detail: "no answer in 12 s" };
    }
    // Any HTTP answer, even an error status, means the server was reached.
    return response.status >= 500
      ? {
          ok: false,
          reason: "unreachable",
          detail: `server answered ${response.status}`,
        }
      : { ok: true };
  } catch (error) {
    return { ok: false, reason: "unreachable", detail: getErrorMessage(error) };
  }
}

/**
 * Asks the server for a new session now, instead of waiting for the next
 * automatic attempt, and reports what happened. Success lets supabase-js emit
 * TOKEN_REFRESHED, which confirms the session for the rest of the app.
 */
export async function retrySessionNow(): Promise<SessionCheckResult> {
  const reach = await checkServerReach();
  if (!reach.ok || !isSupabaseConfigured || !supabase) {
    return { reach, refresh: null };
  }
  try {
    const result = await withTimeout(
      supabase.auth.refreshSession(),
      CHECK_TIMEOUT_MS
    );
    if (result === "timeout") {
      return {
        reach,
        refresh: { ok: false, reason: "timeout", detail: "no answer in 12 s" },
      };
    }
    if (result.error) {
      const status = (result.error as { status?: number }).status;
      const rejected = status === 400 || status === 401 || status === 403;
      return {
        reach,
        refresh: {
          ok: false,
          reason: rejected
            ? "rejected"
            : isTransientNetworkError(result.error)
              ? "unreachable"
              : "other",
          detail: result.error.message,
        },
      };
    }
    return { reach, refresh: { ok: true } };
  } catch (error) {
    return {
      reach,
      refresh: {
        ok: false,
        reason: isTransientNetworkError(error) ? "unreachable" : "other",
        detail: getErrorMessage(error),
      },
    };
  }
}

/**
 * Forget the session on this device only. The account's data and the sync
 * queue stay where they are, and the remembered account is kept, so signing
 * back in as the same person resumes sync with nothing lost. This is not
 * sign-out: it never clears local data.
 */
export async function forgetSessionKeepData(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: "local" });
}
