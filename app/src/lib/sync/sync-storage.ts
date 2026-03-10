const LAST_SYNC_KEY = "okhabit_last_sync_at";

export function loadLastSyncAt(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY) ?? null;
}

export function saveLastSyncAt(ts: string): void {
  localStorage.setItem(LAST_SYNC_KEY, ts);
}
