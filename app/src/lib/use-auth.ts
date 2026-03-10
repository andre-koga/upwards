import { useState, useEffect } from "react";
import {
  supabase,
  isSupabaseConfigured,
  getCachedSession,
} from "@/lib/supabase";
import { syncEngine } from "@/lib/sync";

export function useAuth() {
  const [isAuthed, setIsAuthed] = useState(
    () => Boolean(getCachedSession()),
  );
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Sign in failed",
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
      setAuthError("Check your email to confirm your account!");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Sign up failed",
      );
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await syncEngine.pushBeforeSignOut();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Sign out failed:", error);
    }
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
    signOut,
  };
}
