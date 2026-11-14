import { useSyncExternalStore } from "react";
/** The windows, in days, the journal reading can look back over. */
export const LOOK_BACK_RANGES = [30, 90, 180] as const;
export type LookBackRange = (typeof LOOK_BACK_RANGES)[number];
export const DEFAULT_LOOK_BACK_RANGE: LookBackRange = 30;

// The key keeps its old name so a saved choice survives.
const STORAGE_KEY = "upwards-habits-range";

/**
 * How far back the journal reading looks. A display preference kept on this
 * device, like the theme: it changes what is sent, not any record, so it needs
 * no sync.
 */
function read(): LookBackRange {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return (
      LOOK_BACK_RANGES.find((range) => range === value) ??
      DEFAULT_LOOK_BACK_RANGE
    );
  } catch {
    return DEFAULT_LOOK_BACK_RANGE;
  }
}

let snapshot = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): LookBackRange {
  return snapshot;
}

export function setLookBackRange(next: LookBackRange): void {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Storage full or blocked: the choice still applies this session.
  }
  for (const listener of listeners) listener();
}

export function useLookBackRange(): LookBackRange {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
