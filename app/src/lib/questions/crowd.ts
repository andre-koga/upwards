// The shapes and pure helpers for the anonymous results.

/** How everyone answered one question, as the server reports it. */
export type CrowdResult =
  | { status: "ready"; total: number; counts: Record<string, number> }
  /** Fewer than 5 people are counted, so the server returns no numbers. */
  | { status: "waiting" };

/** Reads the RPC reply, trusting only whole non-negative counts. */
export function parseCrowdResult(data: unknown): CrowdResult | null {
  if (typeof data !== "object" || data === null) return null;
  const body = data as { ready?: unknown; total?: unknown; counts?: unknown };
  if (body.ready === false) return { status: "waiting" };
  if (body.ready !== true) return null;
  if (typeof body.counts !== "object" || body.counts === null) return null;

  const counts: Record<string, number> = {};
  for (const [choice, n] of Object.entries(body.counts)) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return null;
    counts[choice] = n;
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total <= 0) return null;
  return { status: "ready", total, counts };
}

/** The share of `total` that chose a choice, as a whole percent. */
export function sharePercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}
