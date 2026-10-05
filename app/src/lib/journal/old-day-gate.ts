import { isOldDay } from "./old-day-edit";

/**
 * Editing a day older than 7 days asks for confirmation once, then stays
 * confirmed while the user keeps editing that day. Without this grant every
 * tap on a count, or every blur in the journal, would prompt again.
 */
export const OLD_DAY_GRANT_MS = 10 * 60_000;

export interface OldDayEditDecision {
  confirmed: boolean;
  /**
   * True for the edit that was just confirmed. The caller records a journal
   * revision only then, so one confirmed editing session leaves one revision
   * holding the values as they were before it began.
   */
  startsSession: boolean;
}

export interface OldDayPrompt {
  date: string;
  summary: string;
}

interface Pending extends OldDayPrompt {
  resolve: (decision: OldDayEditDecision) => void;
}

const grants = new Map<string, number>();
let pending: Pending | null = null;
let waiting: Array<() => void> = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function pump() {
  if (pending || waiting.length === 0) return;
  waiting.shift()!();
}

/**
 * Resolves immediately for recent days and for days already confirmed. For an
 * older day it shows the confirmation and resolves with the user's answer.
 * Requests queue, so two saves fired at once cannot stack dialogs.
 */
export async function requestOldDayEdit(
  date: string,
  summary: string,
  now: Date = new Date()
): Promise<OldDayEditDecision> {
  if (!isOldDay(date, now)) return { confirmed: true, startsSession: false };

  const granted = () => (grants.get(date) ?? 0) > Date.now();
  if (granted()) {
    grants.set(date, Date.now() + OLD_DAY_GRANT_MS);
    return { confirmed: true, startsSession: false };
  }

  if (pending) await new Promise<void>((resolve) => waiting.push(resolve));
  // A queued request may have been confirmed while this one waited.
  if (granted()) {
    pump();
    return { confirmed: true, startsSession: false };
  }

  return new Promise<OldDayEditDecision>((resolve) => {
    pending = {
      date,
      summary,
      resolve: (decision) => {
        if (decision.confirmed) {
          grants.set(date, Date.now() + OLD_DAY_GRANT_MS);
        }
        pending = null;
        notify();
        resolve(decision);
        pump();
      },
    };
    notify();
  });
}

export function answerOldDayPrompt(confirmed: boolean): void {
  pending?.resolve({ confirmed, startsSession: confirmed });
}

export function getOldDayPrompt(): OldDayPrompt | null {
  return pending;
}

export function subscribeOldDayPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test helper: forget every grant and drop any open prompt. */
export function resetOldDayGate(): void {
  grants.clear();
  pending?.resolve({ confirmed: false, startsSession: false });
  pending = null;
  waiting = [];
}
