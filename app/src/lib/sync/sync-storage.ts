const LAST_SERVER_SYNC_KEY = "okhabit_last_server_sync_at";
const LAST_APPLIED_SEQUENCE_KEY = "okhabit_last_applied_sync_sequence";
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
  clearLastAppliedSequence();
}

/** Last server_sequence applied from pull_sync_operations (default 0). */
export function loadLastAppliedSequence(): number {
  const raw = localStorage.getItem(LAST_APPLIED_SEQUENCE_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function saveLastAppliedSequence(sequence: number): void {
  if (!Number.isFinite(sequence) || sequence < 0) return;
  localStorage.setItem(LAST_APPLIED_SEQUENCE_KEY, String(Math.floor(sequence)));
}

export function clearLastAppliedSequence(): void {
  localStorage.removeItem(LAST_APPLIED_SEQUENCE_KEY);
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
