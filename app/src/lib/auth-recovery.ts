import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { authStorageKey } from "@/lib/auth-gate";
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
  /** A plain GET to the auth server. */
  reach: ServerReach;
  /**
   * A POST to the token endpoint with a made-up token, the same kind of request
   * a session refresh makes. The server refuses the token, which is the point:
   * any HTTP answer shows the request itself gets through.
   */
  post: ServerReach | null;
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

/** Whether a refresh-style POST reaches the server and gets an answer. */
export async function checkTokenEndpoint(): Promise<ServerReach> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const response = await withTimeout(
      fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: "connection-check" }),
      }),
      CHECK_TIMEOUT_MS
    );
    if (response === "timeout") {
      return { ok: false, reason: "timeout", detail: "no answer in 12 s" };
    }
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
    return { reach, post: null, refresh: null };
  }
  const post = await checkTokenEndpoint();
  if (!post.ok) return { reach, post, refresh: null };
  try {
    const result = await withTimeout(
      supabase.auth.refreshSession(),
      CHECK_TIMEOUT_MS
    );
    if (result === "timeout") {
      return {
        reach,
        post,
        refresh: { ok: false, reason: "timeout", detail: "no answer in 12 s" },
      };
    }
    if (result.error) {
      const status = (result.error as { status?: number }).status;
      const rejected = status === 400 || status === 401 || status === 403;
      return {
        reach,
        post,
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
    return { reach, post, refresh: { ok: true } };
  } catch (error) {
    return {
      reach,
      post,
      refresh: {
        ok: false,
        reason: isTransientNetworkError(error) ? "unreachable" : "other",
        detail: getErrorMessage(error),
      },
    };
  }
}

/**
 * Forget the session on this device only, then reload into the sign-in screen.
 * The account's data and the sync queue stay where they are, and the remembered
 * account is kept, so signing back in as the same person resumes sync with
 * nothing lost. This is not sign-out: it never clears local data.
 *
 * It removes the stored session directly instead of calling supabase.auth.signOut.
 * That call waits for the auth lock, and the lock is exactly what a refresh that
 * keeps retrying holds, so it can sit there for as long as the problem lasts.
 */
export function forgetSessionKeepData(): void {
  const key = authStorageKey(import.meta.env.VITE_SUPABASE_URL);
  if (key) {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const name = localStorage.key(i);
      if (name === key || name?.startsWith(`${key}-`)) doomed.push(name);
    }
    doomed.forEach((name) => localStorage.removeItem(name));
  }
  window.location.reload();
}
