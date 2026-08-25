import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  supabase,
  isSupabaseConfigured,
  getCachedSession,
} from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import {
  syncEngine,
  type PushBeforeSignOutResult,
} from "@/lib/sync";
import { clearLocalSyncData } from "@/lib/sync/clear-local-sync-data";
import { clearLastSignedInUserId } from "@/lib/sync/sync-storage";

export class SignOutBlockedError extends Error {
  readonly result: PushBeforeSignOutResult;

  constructor(result: PushBeforeSignOutResult) {
    super("SIGN_OUT_BLOCKED");
    this.name = "SignOutBlockedError";
    this.result = result;
  }
}

export function isSignOutBlockedError(
  error: unknown
): error is SignOutBlockedError {
  return error instanceof SignOutBlockedError;
}

export function useAuth() {
  const { t } = useTranslation("settings");
  const [isAuthed, setIsAuthed] = useState(() => Boolean(getCachedSession()));
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthed(Boolean(data.session));
      setCurrentUserEmail(data.session?.user?.email ?? null);
    })();

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthed(Boolean(session));
      setCurrentUserEmail(session?.user?.email ?? null);
      if (event === "SIGNED_IN") {
        setAuthError(null);
      }
    }).data.subscription;

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (isAuthed) {
        const result = await syncEngine.pushBeforeSignOut();
        if (!result.success) {
          throw new SignOutBlockedError(result);
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      if (isSignOutBlockedError(error)) {
        setAuthError(t("auth.signOutBlocked.inline"));
        throw error;
      }
      setAuthError(
        error instanceof Error ? error.message : t("auth.signInFailed")
      );
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setAuthError(t("auth.checkEmail"));
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.signUpFailed")
      );
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: getAuthRedirectUrl("/settings/reset-password") }
      );
      if (error) throw error;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.resetEmailFailed")
      );
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.updatePasswordFailed")
      );
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const completeSignOut = useCallback(async () => {
    if (!supabase) return;
    await clearLocalSyncData();
    clearLastSignedInUserId();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const signOut = async (options?: { forceDiscard?: boolean }) => {
    if (!supabase) return;

    if (!options?.forceDiscard) {
      const result = await syncEngine.pushBeforeSignOut();
      if (!result.success) {
        throw new SignOutBlockedError(result);
      }
    }

    await completeSignOut();
  };

  return {
    isSupabaseConfigured,
    isAuthed,
    currentUserEmail,
    authLoading,
    authError,
    setAuthError,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    completeSignOut,
  };
}
