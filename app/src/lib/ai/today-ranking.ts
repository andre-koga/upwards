/**
 * The AI's order for Today, kept on this device only (never synced). It is
 * bound to the calendar day it was made for: tomorrow it is simply gone, and the
 * list falls back to the no-AI order until the person asks again.
 */
const KEY = "upwards:ai_today_order";
/** An order older than this is offered for refresh, not hidden. */
export const RANKING_STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export interface RankedActivity {
  id: string;
  /** One line naming the evidence, or null when none was backed by the data. */
  reason: string | null;
}

export interface StoredRanking {
  /** The calendar day (YYYY-MM-DD) the order was made for. */
  date: string;
  generatedAt: string;
  order: RankedActivity[];
}

function isStored(value: unknown): value is StoredRanking {
  const stored = value as StoredRanking | null;
  return (
    typeof stored?.date === "string" &&
    typeof stored?.generatedAt === "string" &&
    Array.isArray(stored?.order) &&
    stored.order.every(
      (row) =>
        typeof row?.id === "string" &&
        (row.reason === null || typeof row.reason === "string")
    )
  );
}

/** The stored order for `date`, or null if there is none for that day. */
export function getStoredRanking(date: string): StoredRanking | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStored(parsed) && parsed.date === date ? parsed : null;
  } catch {
    return null;
  }
}

export function setStoredRanking(ranking: StoredRanking): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ranking));
  } catch {
    // Storage full or blocked: the order still applies for this session.
  }
}

export function clearStoredRanking(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * True when the order may no longer fit: it is old, or an open row (added or
 * unpinned since) is not in it. Finishing rows does not make it stale; they
 * just move down.
 */
export function isRankingStale(
  ranking: StoredRanking,
  candidateIds: readonly string[],
  nowMs: number
): boolean {
  const age = nowMs - new Date(ranking.generatedAt).getTime();
  if (!(age >= 0) || age > RANKING_STALE_AFTER_MS) return true;
  const known = new Set(ranking.order.map((row) => row.id));
  return candidateIds.some((id) => !known.has(id));
}
