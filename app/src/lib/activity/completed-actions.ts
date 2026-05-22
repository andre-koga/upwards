import { db, now } from "@/lib/db";
import type { GoalWithShares } from "@/lib/db/types";
import {
  formatGoalModificationBlockMessage,
  getActiveGoalForActivity,
} from "@/lib/promises/goal-eligibility";
import { appendActivityStatusEvent } from "./status-events";
import { stopCurrentActivity } from "./utils";
import { logError } from "@/lib/error-utils";

/**
 * Mark an activity as done (set completed_at) or reactivate it (clear completed_at).
 * Appends a temporal status event and updates the legacy column for sync/UI.
 */
export async function setActivityCompleted(
  activityId: string,
  completed: boolean,
  actionDate: Date = new Date(),
  options?: {
    goals?: GoalWithShares[];
    userId?: string | null;
  }
): Promise<void> {
  try {
    if (completed && options?.goals) {
      const goal = getActiveGoalForActivity(
        activityId,
        options.goals,
        options.userId
      );
      if (goal) {
        throw new Error(
          formatGoalModificationBlockMessage(goal, "complete")
        );
      }
    }

    if (completed) {
      await stopCurrentActivity({ activityId });
    }
    const n = now();
    await appendActivityStatusEvent(
      activityId,
      "completed",
      completed,
      actionDate
    );
    await db.activities.update(activityId, {
      completed_at: completed ? n : null,
      updated_at: n,
    });
  } catch (error) {
    logError("Error updating activity completion", error);
    throw error;
  }
}
