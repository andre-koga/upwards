export type Band = "low" | "mid" | "high";

export type GapDirection = "close" | "journalHigher" | "journalLower";

/** Scores below this read as low, scores above `HIGH_FROM` as high. */
const LOW_BELOW = 40;
const HIGH_FROM = 60;

/** A difference smaller than this reads as the two portraits agreeing. */
export const GAP_THRESHOLD = 15;

export function band(score: number): Band {
  if (score < LOW_BELOW) return "low";
  if (score >= HIGH_FROM) return "high";
  return "mid";
}

/** Which way the journal reading sits relative to the self-test. */
export function gapDirection(self: number, journal: number): GapDirection {
  const gap = journal - self;
  if (Math.abs(gap) < GAP_THRESHOLD) return "close";
  return gap > 0 ? "journalHigher" : "journalLower";
}
