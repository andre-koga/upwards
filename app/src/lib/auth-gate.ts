/**
 * Whether the app shows its screens or the sign-in screen (product-scope.md §2.6).
 *
 * The decision comes from what is on the device, never from waiting on Supabase.
 * With an expired access token and no network, `getSession()` retries for about
 * 25 seconds and then reports no session, although the refresh token is still
 * stored. Waiting on it would leave a signed-in user on a blank screen and then
 * ask them to sign in, so offline use after the first sign-in would break.
 */

export type GateState = "loading" | "signed_in" | "signed_out";

export interface GateInputs {
  /** False in local dev without Supabase env: there is no account to require. */
  configured: boolean;
  /** A session record is stored on this device, valid or not. */
  hasStoredSession: boolean;
  /** The URL carries an email-confirmation or password-reset token to exchange. */
  arrivingFromEmailLink: boolean;
}

export function initialGateState(input: GateInputs): GateState {
  if (!input.configured) return "signed_in";
  if (input.hasStoredSession) return "signed_in";
  // The token in the URL becomes a session a moment later; showing the sign-in
  // form for that moment would be a flash of the wrong screen.
  if (input.arrivingFromEmailLink) return "loading";
  return "signed_out";
}

export type AuthEventName =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "MFA_CHALLENGE_VERIFIED";

export function nextGateState(
  current: GateState,
  event: AuthEventName,
  hasSession: boolean,
  hasStoredSession: boolean
): GateState {
  if (event === "SIGNED_OUT") return "signed_out";
  if (hasSession) return "signed_in";
  if (event === "INITIAL_SESSION") {
    // No usable session. A stored one that could not be refreshed (offline) is
    // still the user's: keep them in. Only a device with nothing stored, or a
    // loading screen waiting on an email link, resolves to signed out.
    if (hasStoredSession) return "signed_in";
    return "signed_out";
  }
  return current;
}

/** Whether the URL is the landing page of an email link carrying a token. */
export function isEmailLinkUrl(url: { hash: string; search: string }): boolean {
  const hash = url.hash.replace(/^#/, "");
  const search = url.search.replace(/^\?/, "");
  const has = (query: string, key: string) =>
    new URLSearchParams(query).has(key);
  return (
    has(hash, "access_token") ||
    has(hash, "refresh_token") ||
    has(hash, "error_code") ||
    has(search, "code") ||
    has(search, "token_hash")
  );
}

const SESSION_KEY = /^sb-.+-auth-token$/;

/**
 * Whether a Supabase session record is stored. The record is kept when a refresh
 * fails for lack of network and only removed when the server rejects it, so its
 * presence is the right "signed in on this device" signal.
 */
export function hasStoredSession(
  storage: Pick<Storage, "length" | "key" | "getItem">
): boolean {
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !SESSION_KEY.test(key)) continue;
    try {
      const value = JSON.parse(storage.getItem(key) ?? "null") as {
        refresh_token?: unknown;
        user?: { id?: unknown };
      } | null;
      if (value && typeof value.refresh_token === "string" && value.user?.id) {
        return true;
      }
    } catch {
      // Unreadable record: not a session.
    }
  }
  return false;
}
