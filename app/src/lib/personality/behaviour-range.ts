import { useSyncExternalStore } from "react";
import {
  BEHAVIOUR_RANGES,
  DEFAULT_BEHAVIOUR_RANGE,
  type BehaviourRange,
} from "./behaviour";

const STORAGE_KEY = "upwards-habits-range";

/**
 * How far back the habit marks look. A display preference kept on this device,
 * like the theme: it changes what is counted, not any record, so it needs no
 * sync.
 */
function read(): BehaviourRange {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return (
      BEHAVIOUR_RANGES.find((range) => range === value) ??
      DEFAULT_BEHAVIOUR_RANGE
    );
  } catch {
    return DEFAULT_BEHAVIOUR_RANGE;
  }
}

let snapshot = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): BehaviourRange {
  return snapshot;
}

export function setBehaviourRange(next: BehaviourRange): void {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Storage full or blocked: the choice still applies this session.
  }
  for (const listener of listeners) listener();
}

export function useBehaviourRange(): BehaviourRange {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
