import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { GoalWithMembers } from "@/lib/db/types";
import { getCachedUserId } from "@/lib/supabase";
import { toDateString } from "@/lib/time-utils";

export interface GoalProgress {
  currentStreak: number;
  /** True when kind = 'streak_count' and currentStreak >= target_streak. */
  targetReached: boolean;
  /** True when kind = 'streak_until' and view date is past target_end_date. */
  periodEnded: boolean;
  /** 0–100, clamped. null when goal has no target. */
  progressPercent: number | null;
}

export function computeGoalProgress(
  goal: GoalWithMembers,
  currentStreak: number,
  viewDate: Date = new Date()
): GoalProgress {
  const { target_kind, target_streak, target_end_date } = goal;

  if (!target_kind) {
    return { currentStreak, targetReached: false, periodEnded: false, progressPercent: null };
  }

  if (target_kind === "streak_count" && target_streak != null) {
    const targetReached = currentStreak >= target_streak;
    const progressPercent = Math.min(
      100,
      Math.round((currentStreak / target_streak) * 100)
    );
    return { currentStreak, targetReached, periodEnded: false, progressPercent };
  }

  if (target_kind === "streak_until" && target_end_date != null) {
    const viewDateStr = toDateString(viewDate);
    const periodEnded = viewDateStr > target_end_date;
    const startDate = goal.created_at.slice(0, 10);
    const totalDays = Math.max(
      1,
      Math.round(
        (new Date(target_end_date).getTime() - new Date(startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const elapsed = Math.round(
      (new Date(viewDateStr).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const progressPercent = Math.min(
      100,
      Math.max(0, Math.round((elapsed / totalDays) * 100))
    );
    return { currentStreak, targetReached: false, periodEnded, progressPercent };
  }

  return { currentStreak, targetReached: false, periodEnded: false, progressPercent: null };
}

export function getGoalLinkedActivityId(
  goal: GoalWithMembers,
  userId: string | null | undefined = getCachedUserId()
): string | null {
  return (
    goal.members.find(
      (m) => m.user_id === userId && m.invite_status === "accepted"
    )?.member_activity_id ??
    goal.creator_activity_id ??
    null
  );
}

/** @deprecated Prefer computeGoalProgress with activityStreaks from useDailyTasks. */
export function useGoalProgress(goal: GoalWithMembers | undefined): GoalProgress {
  const activityId = goal ? getGoalLinkedActivityId(goal) : null;
  const [currentStreak, setCurrentStreak] = useState(0);

  useEffect(() => {
    if (!activityId) {
      setCurrentStreak(0);
      return;
    }

    void db.activityStreaks
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

  return computeGoalProgress(goal, currentStreak);
}
