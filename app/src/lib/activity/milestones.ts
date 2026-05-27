/** Auto milestone thresholds (days). */
export const STREAK_MILESTONES = [
  0, 1, 2, 3, 5, 7, 10, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 365,
] as const;

export interface MilestoneProgress {
  current: number;
  prev: number;
  next: number;
  progressPercent: number;
}

/** Progress through the span between prev and next milestones (e.g. 45 of 30→50 = 75%). */
export function milestoneProgressPercent(
  current: number,
  prev: number,
  next: number
): number {
  const span = next - prev;
  if (span <= 0) return current >= next ? 100 : 0;
  return Math.min(100, Math.round(((current - prev) / span) * 100));
}

/** True when streak sits exactly on a ladder milestone (start of a new segment). */
export function isAtMilestoneReached(progress: MilestoneProgress): boolean {
  const { current, prev } = progress;
  return (
    current > 0 &&
    current === prev &&
    (STREAK_MILESTONES as readonly number[]).includes(current)
  );
}

export function getMilestoneProgress(streak: number): MilestoneProgress {
  const current = Math.max(0, Math.floor(streak));
  const next =
    STREAK_MILESTONES.find((m) => m > current) ??
    current + Math.max(10, Math.floor(current * 0.25) || 10);

  const nextIndex = STREAK_MILESTONES.indexOf(
    next as (typeof STREAK_MILESTONES)[number]
  );
  const prev = nextIndex > 0 ? STREAK_MILESTONES[nextIndex - 1]! : 0;

  const progressPercent = milestoneProgressPercent(current, prev, next);

  return { current, prev, next, progressPercent };
}

export function formatMilestoneStreakLine(
  streak: number,
  routine: string | null,
  progress: MilestoneProgress
): string {
  const unit =
    routine === "never" ? "days without slip" : "day streak";
  if (progress.current >= progress.next) {
    return `${progress.current} ${unit}`;
  }
  return `${progress.current} / ${progress.next} ${unit}`;
}

export function formatMilestoneLabel(routine: string | null): string {
  return routine === "never" ? "days without slip" : "day streak";
}

export function showsMilestones(routine: string | null): boolean {
  return routine !== "anytime";
}
