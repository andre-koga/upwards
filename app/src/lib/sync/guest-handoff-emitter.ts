/**
 * Lightweight pub/sub bridge so main.tsx (outside React) can signal the
 * React tree that a handoff dialog is needed without using window events.
 */
export type HandoffReason =
  /** Guest data exists and this is the first sign-in on this device. */
  | "guest_data"
  /**
   * A different account was signed in on this device and it still holds data the
   * server never accepted. Wiping would destroy the only copy, so the user has to
   * decide.
   */
  | "account_switch_unsynced";

export interface HandoffRequest {
  userId: string;
  reason: HandoffReason;
  /** Unsynced ops plus locally-edited rows, for the account-switch warning. */
  unsyncedCount?: number;
}

type HandoffListener = (request: HandoffRequest) => void;

const listeners = new Set<HandoffListener>();

export function onGuestHandoffNeeded(cb: HandoffListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitGuestHandoffNeeded(request: HandoffRequest): void {
  listeners.forEach((cb) => cb(request));
}
