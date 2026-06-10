const LAST_SERVER_SYNC_KEY = "okhabit_last_server_sync_at";
const LAST_USER_KEY = "okhabit_last_signed_in_user_id";

/**
 * The server-side `now()` timestamp captured at the start of the last
 * successful pull. Using server time (not client time) as the delta-pull
 * cutoff eliminates device clock skew entirely.
 */
export function loadLastServerSyncAt(): string | null {
  return localStorage.getItem(LAST_SERVER_SYNC_KEY) ?? null;
}

export function saveLastServerSyncAt(ts: string): void {
  localStorage.setItem(LAST_SERVER_SYNC_KEY, ts);
}

export function clearLastServerSyncAt(): void {
  localStorage.removeItem(LAST_SERVER_SYNC_KEY);
}

export function loadLastSignedInUserId(): string | null {
  return localStorage.getItem(LAST_USER_KEY) ?? null;
}

export function saveLastSignedInUserId(userId: string): void {
  localStorage.setItem(LAST_USER_KEY, userId);
}

export function clearLastSignedInUserId(): void {
  localStorage.removeItem(LAST_USER_KEY);
}
