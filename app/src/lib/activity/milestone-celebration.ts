import type { MilestoneProgress } from "./milestones";
import { STREAK_MILESTONES, isAtMilestoneReached } from "./milestones";

export type MilestoneCelebrationMeta = {
  firstSeenDate?: string;
  acked?: boolean;
};

const listeners = new Set<() => void>();

export function subscribeMilestoneCelebration(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyMilestoneCelebrationChange(): void {
  listeners.forEach((listener) => listener());
}

function storageKey(activityId: string, milestone: number): string {
  return `okhabit:milestone-celebration:${activityId}:${milestone}`;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readMeta(activityId: string, milestone: number): MilestoneCelebrationMeta | null {
  try {
    const raw = localStorage.getItem(storageKey(activityId, milestone));
    if (!raw) return null;
    return JSON.parse(raw) as MilestoneCelebrationMeta;
  } catch {
    return null;
  }
}

function writeMeta(
  activityId: string,
  milestone: number,
  meta: MilestoneCelebrationMeta
): void {
  localStorage.setItem(storageKey(activityId, milestone), JSON.stringify(meta));
}

/** User tapped through the milestone celebration UI. */
export function acknowledgeMilestoneCelebration(
  activityId: string,
  milestone: number
): void {
  writeMeta(activityId, milestone, { acked: true });
  notifyMilestoneCelebrationChange();
}

/**
 * First time we show the milestone gate for this activity, record today so we can
 * auto-advance the UI on a later calendar day without requiring a button press.
 */
export function ensureMilestoneCelebrationSeen(
  activityId: string,
  progress: MilestoneProgress
): void {
  if (!isAtMilestoneReached(progress)) return;
  const milestone = progress.current;
  const meta = readMeta(activityId, milestone);
  if (meta?.acked || meta?.firstSeenDate) return;
  writeMeta(activityId, milestone, { firstSeenDate: toDateString(new Date()) });
}

/**
 * Celebration UI is pending: exactly on a ladder milestone and not yet acknowledged.
 * If the user skips the button, a new calendar day still shows normal progress toward next.
 */
export function isMilestoneCelebrationPending(
  activityId: string,
  progress: MilestoneProgress | null
): boolean {
  if (!progress || !isAtMilestoneReached(progress)) return false;

  const milestone = progress.current;
  const meta = readMeta(activityId, milestone);
  if (meta?.acked) return false;

  const today = toDateString(new Date());
  if (meta?.firstSeenDate && meta.firstSeenDate !== today) {
    writeMeta(activityId, milestone, { acked: true });
    notifyMilestoneCelebrationChange();
    return false;
  }

  return true;
}

export function formatMilestoneCongratulations(
  milestone: number,
  routine: string | null
): string {
  const unit = routine === "never" ? "days without slip" : "day streak";
  return `You reached ${milestone} ${unit}!`;
}
