import { useSyncExternalStore } from "react";

/** Keep in sync with the matching read in `index.html`, which runs before paint. */
export const COMPACT_SCREEN_EDGES_KEY = "upwards-compact-screen-edges";

export const COMPACT_SCREEN_EDGES_CLASS = "compact-screen-edges";

/**
 * Whether this device should drop the extra top and bottom inset the app adds
 * for the notch and the home indicator. The installed iPhone app already
 * leaves that space, so adding it again opens a gap above the date and under
 * the tab bar. A display choice for this screen, like the theme: it changes
 * no record and does not sync.
 */
function read(): boolean {
  try {
    return localStorage.getItem(COMPACT_SCREEN_EDGES_KEY) === "1";
  } catch {
    return false;
  }
}

function apply(next: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(COMPACT_SCREEN_EDGES_CLASS, next);
}

let snapshot = read();
apply(snapshot);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return snapshot;
}

export function getCompactScreenEdges(): boolean {
  return snapshot;
}

export function setCompactScreenEdges(next: boolean): void {
  snapshot = next;
  apply(next);
  try {
    localStorage.setItem(COMPACT_SCREEN_EDGES_KEY, next ? "1" : "0");
  } catch {
    // Storage full or blocked: the choice still applies this session.
  }
  for (const listener of listeners) listener();
}

export function useCompactScreenEdges(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
