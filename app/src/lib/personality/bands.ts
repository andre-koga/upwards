export type Band = "low" | "mid" | "high";

/** Five steps of the same score, for the longer description of a trait. */
export type Level = "veryLow" | "low" | "mid" | "high" | "veryHigh";

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

/**
 * Fifths of the scale: 0-19, 20-39, 40-59, 60-79, 80-100. The outer fifths
 * are the strong ends; low, mid and high match the three bands above.
 */
export function level(score: number): Level {
  if (score < 20) return "veryLow";
  if (score < LOW_BELOW) return "low";
  if (score < HIGH_FROM) return "mid";
  if (score < 80) return "high";
  return "veryHigh";
}

/** Which way the journal reading sits relative to the self-test. */
export function gapDirection(self: number, journal: number): GapDirection {
  const gap = journal - self;
  if (Math.abs(gap) < GAP_THRESHOLD) return "close";
  return gap > 0 ? "journalHigher" : "journalLower";
}
