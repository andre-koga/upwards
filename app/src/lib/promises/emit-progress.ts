import { supabase, getCachedUserId } from "@/lib/supabase";
import { db, newId, now } from "@/lib/db";
import type { Goal, ProgressPayload } from "@/lib/db/types";
import { computeGoalProgress } from "@/lib/promises/use-goal-progress";
import { getOrComputeActivityStreaksForDate } from "@/lib/streak-utils";

type GoalTargetFields = Pick<
  Goal,
  "id" | "target_kind" | "target_streak" | "target_end_date" | "created_at"
>;

function isGoalTargetReached(
  goal: GoalTargetFields,
  streak: number,
  dateString: string
): boolean {
  const { targetReached, periodEnded } = computeGoalProgress(
    goal,
    streak,
    new Date(`${dateString}T00:00:00`)
  );
  return targetReached || periodEnded;
}

async function upsertProgressEvent(params: {
  promiseId: string;
  userId: string;
  dateString: string;
  payload: ProgressPayload;
  bumpTimestamp?: boolean;
}): Promise<void> {
  if (!supabase) return;

  const { data: existing, error: findErr } = await supabase
    .from("promise_progress_events")
    .select("id, payload, created_at")
    .eq("promise_id", params.promiseId)
    .eq("user_id", params.userId)
    .eq("date", params.dateString)
    .maybeSingle();

  if (findErr) throw findErr;

  const ts = now();

  if (existing?.id) {
    const mergedPayload: ProgressPayload = {
      ...((existing.payload as ProgressPayload | null) ?? {}),
      ...params.payload,
    };

    const { error } = await supabase
      .from("promise_progress_events")
      .update({
        payload: mergedPayload,
        ...(params.bumpTimestamp ? { created_at: ts } : {}),
      })
      .eq("id", existing.id as string);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("promise_progress_events").insert({
    id: newId(),
    promise_id: params.promiseId,
    user_id: params.userId,
    date: params.dateString,
    payload: params.payload,
    created_at: ts,
  });

  if (error) throw error;
}

async function resolveEmitStreak(
  activityId: string,
  dateString: string
): Promise<number> {
  const activity = await db.activities.get(activityId);
  if (!activity) return 0;

  const streaks = await getOrComputeActivityStreaksForDate(
    [activity],
    new Date(`${dateString}T00:00:00`),
    { forceRecomputeTarget: true }
  );

  return streaks[activityId] ?? 0;
}

export async function emitDailyComplete(params: {
  activityId: string;
  activityName: string;
  newCount: number;
  completionTarget: number;
  dateString: string;
}): Promise<void> {
  if (!supabase) return;
  const userId = getCachedUserId();
  if (!userId) return;

  if (params.newCount !== params.completionTarget) return;

  const { data: activeGoals, error: goalsErr } = await supabase
    .from("promises")
    .select("id, target_kind, target_streak, target_end_date, created_at, activity_name")
    .eq("user_id", userId)
    .eq("activity_id", params.activityId)
    .eq("status", "active");

  if (goalsErr) throw goalsErr;
  if (!activeGoals || activeGoals.length === 0) return;

  const ts = now();
  await supabase
    .from("promises")
    .update({ activity_name: params.activityName, updated_at: ts })
    .eq("user_id", userId)
    .eq("activity_id", params.activityId)
    .eq("status", "active");

  const streak = await resolveEmitStreak(params.activityId, params.dateString);

  await Promise.all(
    activeGoals.map(async (goal) => {
      const goalTargetReached = isGoalTargetReached(
        goal as GoalTargetFields,
        streak,
        params.dateString
      );

      const payload: ProgressPayload = {
        activityName: params.activityName,
        streak,
        completionTarget: params.completionTarget,
        goalTargetReached: goalTargetReached || undefined,
      };

      try {
        await upsertProgressEvent({
          promiseId: goal.id as string,
          userId,
          dateString: params.dateString,
          payload,
          bumpTimestamp: goalTargetReached,
        });
      } catch (error) {
        console.warn("[goals] emitDailyComplete failed:", error);
      }
    })
  );
}

export async function emitGoalTargetReached(params: {
  goalId: string;
  activityName: string;
  streak: number;
  dateString: string;
}): Promise<void> {
  if (!supabase) return;
  const userId = getCachedUserId();
  if (!userId) return;

  try {
    await upsertProgressEvent({
      promiseId: params.goalId,
      userId,
      dateString: params.dateString,
      payload: {
        activityName: params.activityName,
        streak: params.streak,
        goalTargetReached: true,
      },
      bumpTimestamp: true,
    });
  } catch (error) {
    console.warn("[goals] emitGoalTargetReached failed:", error);
  }
}
