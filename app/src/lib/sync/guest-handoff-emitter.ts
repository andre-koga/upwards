/**
 * Lightweight pub/sub bridge so main.tsx (outside React) can signal the
 * React tree that a guest-handoff dialog is needed without using window events.
 */
type HandoffListener = (userId: string) => void;

const listeners = new Set<HandoffListener>();

export function onGuestHandoffNeeded(cb: HandoffListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitGuestHandoffNeeded(userId: string): void {
  listeners.forEach((cb) => cb(userId));
}
