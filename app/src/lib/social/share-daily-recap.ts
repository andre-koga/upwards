import { supabase, getCachedUserId } from "@/lib/supabase";
import { newId, now } from "@/lib/db";
import type { DailyRecapData } from "@/lib/recap/get-daily-recap";
import { getActivityDisplayName } from "@/lib/activity";

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

export interface SummaryCompletion {
  activityName: string;
  streak: number;
  routine: string | null;
}

/**
 * Upserts one `friend_daily_summaries` row for the given date so all
 * accepted friends can see the user's day summary.
 */
export async function shareDailyRecap(
  recap: DailyRecapData,
  caption: string
): Promise<void> {
  if (!supabase) return;
  const userId = getCachedUserId();
  if (!userId) return;

  const friendsExist = await hasAcceptedFriends(userId);
  if (!friendsExist) return;

  const completions: SummaryCompletion[] = recap.completed.map((item) => ({
    activityName: getActivityDisplayName(item.activity, item.group),
    streak: item.streak,
    routine: item.activity.routine,
  }));

  const ts = now();
  const row = {
    id: newId(),
    user_id: userId,
    date: recap.date,
    caption: caption.trim() || null,
    completed_count: recap.completed.length,
    total_count: recap.completed.length + recap.missed.length,
    total_tracked_ms: recap.totalTrackedMs,
    completions,
    created_at: ts,
    updated_at: ts,
  };

  const { error } = await supabase
    .from("friend_daily_summaries")
    .upsert(row, { onConflict: "user_id,date" });

  if (error) {
    console.warn("[social] shareDailyRecap failed:", error);
    throw error;
  }
}
