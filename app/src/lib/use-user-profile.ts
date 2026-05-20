import { useCallback, useEffect, useState } from "react";
import { supabase, getCachedUserId, getCachedSession } from "@/lib/supabase";
import { now } from "@/lib/db";

interface UserProfileState {
  username: string | null;
  displayName: string | null;
  loading: boolean;
  error: string | null;
}

export function useUserProfile() {
  // Reactive user id — getCachedUserId() alone is not enough on reload because
  // the session cache is filled asynchronously after validateSession().
  const [userId, setUserId] = useState<string | null>(() => getCachedUserId());

  const [state, setState] = useState<UserProfileState>({
    username: null,
    displayName: null,
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
        username: null,
        displayName: null,
        loading: Boolean(getCachedSession()),
        error: null,
      });
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("username, display_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setState({
        username: (data?.username as string | null) ?? null,
        displayName: (data?.display_name as string | null) ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
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

  const setUsername = useCallback(
    async (username: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: "Not signed in" };
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return { error: "Username must be 3–20 characters: a-z, 0-9, underscore only." };
      }
      try {
        const { error } = await supabase.from("user_profiles").upsert(
          {
            user_id: userId,
            username,
            updated_at: now(),
          },
          { onConflict: "user_id" }
        );
        if (error) {
          if (error.code === "23505") {
            return { error: "That username is already taken." };
          }
          throw error;
        }
        setState((s) => ({ ...s, username, error: null }));
        return { error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save username";
        setState((s) => ({ ...s, error: msg }));
        return { error: msg };
      }
    },
    [userId]
  );

  const setDisplayName = useCallback(
    async (displayName: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: "Not signed in" };
      try {
        const { error } = await supabase.from("user_profiles").upsert(
          { user_id: userId, display_name: displayName, updated_at: now() },
          { onConflict: "user_id" }
        );
        if (error) throw error;
        setState((s) => ({ ...s, displayName, error: null }));
        return { error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save display name";
        return { error: msg };
      }
    },
    [userId]
  );

  return {
    ...state,
    reload: load,
    setUsername,
    setDisplayName,
  };
}

/** Look up a user by exact username. Returns null if not found.
 *  No prefix search — privacy-preserving. */
export async function lookupUserByUsername(
  username: string
): Promise<{ user_id: string; username: string; display_name: string | null } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("lookup_user_by_username", {
    exact_username: username,
  });
  if (error || !data || (data as unknown[]).length === 0) return null;
  const row = (data as Array<{ user_id: string; username: string; display_name: string | null }>)[0];
  return row ?? null;
}
