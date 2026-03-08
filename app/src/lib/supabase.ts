import { createClient, type Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null

// ─── Reactive session cache ───────────────────────────────────────────────────
// We keep a synchronous cache updated by onAuthStateChange so that the sync
// engine never needs to make a network call just to read the current user.

let _cachedSession: Session | null = null

if (supabase) {
  // Populate cache immediately from storage (no network round-trip needed)
  supabase.auth.getSession().then(({ data }) => {
    _cachedSession = data.session ?? null
  })

  // Stay up to date reactively
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedSession = session
  })
}

/** Synchronous – returns the cached user id or null. */
export function getCachedUserId(): string | null {
  return _cachedSession?.user?.id ?? null
}

/** Synchronous – returns the cached session or null. */
export function getCachedSession(): Session | null {
  return _cachedSession
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Returns true when a user is signed in (synchronous, no I/O). */
export function isAuthenticated(): boolean {
  return _cachedSession !== null
}

/** Async – resolves the userId, waiting for the initial session load.
 *  Prefer getCachedUserId() everywhere the cache is already warm. */
export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  _cachedSession = data.session ?? null
  return _cachedSession?.user?.id ?? null
}
