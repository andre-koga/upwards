/** Auto milestone thresholds (days). */
export const STREAK_MILESTONES = [
  1, 3, 5, 7, 10, 14, 21, 30, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 365,
] as const;

export interface MilestoneProgress {
  current: number;
  prev: number;
  next: number;
  progressPercent: number;
}

export function getMilestoneProgress(streak: number): MilestoneProgress {
  const current = Math.max(0, Math.floor(streak));
  const prev =
    [...STREAK_MILESTONES].reverse().find((m) => m <= current) ?? 0;
  const next =
    STREAK_MILESTONES.find((m) => m > current) ??
    current + Math.max(10, Math.floor(current * 0.25) || 10);

  const span = next - prev;
  const progressPercent =
    span <= 0 ? 100 : Math.min(100, Math.round(((current - prev) / span) * 100));

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
