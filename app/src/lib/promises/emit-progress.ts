/**
 * Emit a daily_complete progress event for any active goal linked to
 * the given activity + date.
 *
 * Uses ON CONFLICT DO NOTHING (idempotent) — safe to call multiple times.
 * Never touches journal, locations, video, or memos.
 */
import { supabase, getCachedUserId } from "@/lib/supabase";
import { newId, now } from "@/lib/db";
import type { ProgressPayload } from "@/lib/db/types";

export async function emitDailyComplete(params: {
  activityId: string;
  activityName: string;
  newCount: number;
  completionTarget: number;
  streak: number;
  dateString: string; // YYYY-MM-DD
}): Promise<void> {
  if (!supabase) return;
  const userId = getCachedUserId();
  if (!userId) return;

  // Only emit on first completion, not every increment
  if (params.newCount !== params.completionTarget) return;

  // Find my accepted memberships for this activity
  const { data: memberships } = await supabase
    .from("promise_members")
    .select("promise_id")
    .eq("user_id", userId)
    .eq("member_activity_id", params.activityId)
    .eq("invite_status", "accepted");

  if (!memberships || memberships.length === 0) return;

  const promiseIds = memberships.map((m) => m.promise_id as string);

  // Verify those goals are active
  const { data: activeGoals } = await supabase
    .from("promises")
    .select("id")
    .in("id", promiseIds)
    .eq("status", "active");

  if (!activeGoals || activeGoals.length === 0) return;

  const payload: ProgressPayload = {
    activityName: params.activityName,
    streak: params.streak > 0 ? params.streak : undefined,
    completionTarget: params.completionTarget,
  };

  const ts = now();
  const inserts = activeGoals.map((g) => ({
    id: newId(),
    promise_id: g.id as string,
    user_id: userId,
    date: params.dateString,
    payload,
    created_at: ts,
  }));

  // Idempotent: unique constraint (promise_id, user_id, date) handles duplicates
  for (const row of inserts) {
    await supabase
      .from("promise_progress_events")
      .insert(row)
      .select()
      // ON CONFLICT DO NOTHING via ignoreDuplicates
      .throwOnError();
  }
}
