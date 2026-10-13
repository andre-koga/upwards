import { useSyncExternalStore } from "react";

const STORAGE_KEY = "upwards-today-done-last";

/**
 * Whether done habits sink below the open ones on Today. A display preference
 * kept on this device, like the theme: it changes how the list is shown, not
 * any record, so it needs no sync. Defaults to sinking.
 */
function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

let snapshot = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return snapshot;
}

export function setDoneLast(next: boolean): void {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Storage full or blocked: the choice still applies this session.
  }
  for (const listener of listeners) listener();
}

export function useDoneLast(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
