type SyncScheduler = () => void;

let scheduler: SyncScheduler | null = null;

export function registerSyncScheduler(fn: SyncScheduler): void {
  scheduler = fn;
}

export function clearSyncScheduler(): void {
  scheduler = null;
}

/** Ask the engine to debounce a push/pull. No-op until auto-sync is running. */
export function requestDebouncedSync(): void {
  scheduler?.();
}
