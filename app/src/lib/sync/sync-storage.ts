const LAST_SYNC_KEY = "okhabit_last_sync_at";
const LAST_USER_KEY = "okhabit_last_signed_in_user_id";

export function loadLastSyncAt(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY) ?? null;
}

export function saveLastSyncAt(ts: string): void {
  localStorage.setItem(LAST_SYNC_KEY, ts);
}

export function clearLastSyncAt(): void {
  localStorage.removeItem(LAST_SYNC_KEY);
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
