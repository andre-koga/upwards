import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Goal } from "@/lib/db/types";
import { toDateString } from "@/lib/time-utils";

export interface GoalProgress {
  currentStreak: number;
  targetReached: boolean;
  periodEnded: boolean;
  progressPercent: number | null;
}

export function computeGoalProgress(
  goal: Pick<Goal, "target_kind" | "target_streak" | "target_end_date" | "created_at">,
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

export function getGoalActivityId(goal: Goal): string | null {
  return goal.activity_id ?? null;
}

export function useGoalProgress(goal: Goal | undefined): GoalProgress {
  const activityId = goal ? getGoalActivityId(goal) : null;
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
