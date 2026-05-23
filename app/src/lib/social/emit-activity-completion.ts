import { supabase, getCachedUserId } from "@/lib/supabase";
import { db, newId, now } from "@/lib/db";
import type { Activity } from "@/lib/db/types";
import { getMilestoneProgress } from "@/lib/activity/milestones";
import { getOrComputeActivityStreaksForDate } from "@/lib/streak-utils";
import { fromDateString } from "@/lib/time-utils";

async function hasAcceptedFriends(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("friendships")
    .select("user_a")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .limit(1);
  if (error) {
    console.warn("[social] friendships check failed:", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function emitActivityCompletion(params: {
  activity: Activity;
  activityName: string;
  dateString: string;
}): Promise<void> {
  if (!supabase) return;
  const userId = getCachedUserId();
  if (!userId) return;
  if (!params.activity.share_completions_with_friends) return;

  const friendsExist = await hasAcceptedFriends(userId);
  if (!friendsExist) return;

  const streaks = await getOrComputeActivityStreaksForDate(
    [params.activity],
    fromDateString(params.dateString),
    { forceRecomputeTarget: true }
  );
  const streak = streaks[params.activity.id] ?? 0;
  const { prev, next } = getMilestoneProgress(streak);

  const row = {
    id: newId(),
    user_id: userId,
    activity_id: params.activity.id,
    activity_name: params.activityName,
    date: params.dateString,
    streak,
    milestone_prev: prev,
    milestone_next: next,
    routine: params.activity.routine,
    created_at: now(),
  };

  const { error } = await supabase.from("friend_activity_completions").upsert(
    row,
    { onConflict: "user_id,activity_id,date" }
  );

  if (error) {
    console.warn("[social] emitActivityCompletion failed:", error);
  }
}
