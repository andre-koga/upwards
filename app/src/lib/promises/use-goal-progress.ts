import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { GoalWithMembers } from "@/lib/db/types";

export interface GoalProgress {
  currentStreak: number;
  /** True when kind = 'streak_count' and currentStreak >= target_streak. */
  targetReached: boolean;
  /** True when kind = 'streak_until' and today is past target_end_date. */
  periodEnded: boolean;
  /** 0–100, clamped. null when goal has no target. */
  progressPercent: number | null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useGoalProgress(goal: GoalWithMembers | undefined): GoalProgress {
  const [currentStreak, setCurrentStreak] = useState(0);

  const activityId = goal?.creator_activity_id ?? null;

  useEffect(() => {
    if (!activityId) {
      setCurrentStreak(0);
      return;
    }

    // Read the most recent streak row for this activity from the local Dexie DB.
    db.activityStreaks
      .where("activity_id")
      .equals(activityId)
      .reverse()
      .sortBy("date")
      .then((rows) => {
        setCurrentStreak(rows[0]?.streak ?? 0);
      })
      .catch(() => setCurrentStreak(0));
  }, [activityId]);

  if (!goal) {
    return { currentStreak: 0, targetReached: false, periodEnded: false, progressPercent: null };
  }

  const { target_kind, target_streak, target_end_date } = goal;

  if (!target_kind) {
    return { currentStreak, targetReached: false, periodEnded: false, progressPercent: null };
  }

  if (target_kind === "streak_count" && target_streak != null) {
    const targetReached = currentStreak >= target_streak;
    const progressPercent = Math.min(100, Math.round((currentStreak / target_streak) * 100));
    return { currentStreak, targetReached, periodEnded: false, progressPercent };
  }

  if (target_kind === "streak_until" && target_end_date != null) {
    const today = todayStr();
    const periodEnded = today > target_end_date;
    // Days elapsed from the goal's created_at date to target_end_date.
    const startDate = goal.created_at.slice(0, 10);
    const totalDays = Math.max(
      1,
      Math.round(
        (new Date(target_end_date).getTime() - new Date(startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const elapsed = Math.round(
      (new Date(today).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
    return { currentStreak, targetReached: false, periodEnded, progressPercent };
  }

  return { currentStreak, targetReached: false, periodEnded: false, progressPercent: null };
}
