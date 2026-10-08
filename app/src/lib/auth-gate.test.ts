import { describe, expect, it } from "vitest";
import {
  hasStoredSession,
  initialGateState,
  isEmailLinkUrl,
  nextGateState,
} from "./auth-gate";

const base = {
  configured: true,
  hasStoredSession: false,
  arrivingFromEmailLink: false,
};

describe("initialGateState", () => {
  it("shows the sign-in screen on a fresh install", () => {
    expect(initialGateState(base)).toBe("signed_out");
  });

  it("shows the app straight away when a session is stored, without waiting on the network", () => {
    expect(initialGateState({ ...base, hasStoredSession: true })).toBe(
      "signed_in"
    );
  });

  it("waits, instead of flashing sign-in, when arriving from an email link", () => {
    expect(initialGateState({ ...base, arrivingFromEmailLink: true })).toBe(
      "loading"
    );
  });

  it("prefers a stored session over an email link", () => {
    expect(
      initialGateState({
        ...base,
        hasStoredSession: true,
        arrivingFromEmailLink: true,
      })
    ).toBe("signed_in");
  });

  it("does not gate a build with no Supabase configured", () => {
    expect(initialGateState({ ...base, configured: false })).toBe("signed_in");
  });
});

describe("nextGateState", () => {
  it("lets the user in when they sign in", () => {
    expect(nextGateState("signed_out", "SIGNED_IN", true, true)).toBe(
      "signed_in"
    );
  });

  it("sends the user to sign-in when they sign out", () => {
    expect(nextGateState("signed_in", "SIGNED_OUT", false, false)).toBe(
      "signed_out"
    );
  });

  it("signs out even if a stale record is still stored", () => {
    expect(nextGateState("signed_in", "SIGNED_OUT", false, true)).toBe(
      "signed_out"
    );
  });

  it("keeps a user in who opens the app offline with an expired token", () => {
    // Supabase reports INITIAL_SESSION with no session after ~25s of retries,
    // but the refresh token is still stored. This must not lock them out.
    expect(nextGateState("signed_in", "INITIAL_SESSION", false, true)).toBe(
      "signed_in"
    );
  });

  it("resolves a device with nothing stored to sign-in", () => {
    expect(nextGateState("loading", "INITIAL_SESSION", false, false)).toBe(
      "signed_out"
    );
  });

  it("resolves an email link that became a session to signed in", () => {
    expect(nextGateState("loading", "SIGNED_IN", true, true)).toBe("signed_in");
    expect(nextGateState("loading", "PASSWORD_RECOVERY", true, true)).toBe(
      "signed_in"
    );
  });

  it("ignores events that carry no session and say nothing about sign-in", () => {
    expect(nextGateState("signed_in", "TOKEN_REFRESHED", false, true)).toBe(
      "signed_in"
    );
    expect(nextGateState("signed_out", "USER_UPDATED", false, false)).toBe(
      "signed_out"
    );
  });
});

describe("isEmailLinkUrl", () => {
  const url = (hash = "", search = "") => ({ hash, search });

  it("recognises the implicit-flow token in the hash", () => {
    expect(isEmailLinkUrl(url("#access_token=a&type=recovery"))).toBe(true);
    expect(isEmailLinkUrl(url("#error_code=otp_expired"))).toBe(true);
  });

  it("recognises the PKCE code and the token hash in the query", () => {
    expect(isEmailLinkUrl(url("", "?code=abc"))).toBe(true);
    expect(isEmailLinkUrl(url("", "?token_hash=abc&type=signup"))).toBe(true);
  });

  it("does not mistake an ordinary page for an email link", () => {
    expect(isEmailLinkUrl(url())).toBe(false);
    expect(isEmailLinkUrl(url("#section", "?tab=journal"))).toBe(false);
  });
});

describe("hasStoredSession", () => {
  function storage(entries: Record<string, string>) {
    const keys = Object.keys(entries);
    return {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => entries[k] ?? null,
    };
  }
  const session = JSON.stringify({
    refresh_token: "r",
    access_token: "a",
    user: { id: "u1" },
  });

  it("finds a stored session, whatever the project's key prefix", () => {
    expect(hasStoredSession(storage({ "sb-abcd-auth-token": session }))).toBe(
      true
    );
    // The local Supabase stack uses the first host label, e.g. 127.
    expect(hasStoredSession(storage({ "sb-127-auth-token": session }))).toBe(
      true
    );
  });

  it("is false with nothing stored", () => {
    expect(hasStoredSession(storage({}))).toBe(false);
  });

  it("ignores the PKCE code-verifier record, which is not a session", () => {
    expect(
      hasStoredSession(
        storage({ "sb-abcd-auth-token-code-verifier": "verifier" })
      )
    ).toBe(false);
  });

  it("ignores unrelated and unreadable records", () => {
    expect(
      hasStoredSession(
        storage({ theme: "dark", "sb-abcd-auth-token": "{not json" })
      )
    ).toBe(false);
  });

  it("ignores a record with no refresh token or user", () => {
    expect(hasStoredSession(storage({ "sb-abcd-auth-token": "{}" }))).toBe(
      false
    );
  });
});
