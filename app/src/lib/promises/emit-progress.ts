/**
 * Emits a daily_complete progress event for any active promise linked to
 * the given activity + date, if the user just met their completion target.
 *
 * Called from the task increment hook after writing task_counts to DB.
 * Never touches journal, locations, video, or memos.
 */
import { supabase, getCachedUserId } from "@/lib/supabase";
import { newId, now } from "@/lib/db";
import type { ProgressPayload } from "@/lib/db/types";

export async function emitProgressIfComplete(params: {
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

  // Only emit when the count exactly hits the target (first completion, not every increment)
  if (params.newCount !== params.completionTarget) return;

  const { data: memberships } = await supabase
    .from("promise_members")
    .select("promise_id")
    .eq("user_id", userId)
    .eq("invite_status", "accepted")
    .not("member_activity_id", "is", null);

  if (!memberships || memberships.length === 0) return;

  // Find memberships whose linked activity is the one just completed
  const { data: matchingMemberships } = await supabase
    .from("promise_members")
    .select("promise_id")
    .eq("user_id", userId)
    .eq("member_activity_id", params.activityId)
    .eq("invite_status", "accepted");

  if (!matchingMemberships || matchingMemberships.length === 0) return;

  const promiseIds = matchingMemberships.map((m) => m.promise_id as string);

  // Check promises are active
  const { data: activePromises } = await supabase
    .from("promises")
    .select("id")
    .in("id", promiseIds)
    .eq("status", "active");

  if (!activePromises || activePromises.length === 0) return;

  const payload: ProgressPayload = {
    activityName: params.activityName,
    streak: params.streak > 0 ? params.streak : undefined,
    completionTarget: params.completionTarget,
  };

  const ts = now();
  const inserts = activePromises.map((p) => ({
    id: newId(),
    promise_id: p.id as string,
    user_id: userId,
    date: params.dateString,
    kind: "daily_complete" as const,
    payload,
    created_at: ts,
  }));

  // Upsert to avoid duplicate events for the same day (idempotent)
  for (const event of inserts) {
    const { data: existing } = await supabase
      .from("promise_progress_events")
      .select("id")
      .eq("promise_id", event.promise_id)
      .eq("user_id", userId)
      .eq("date", params.dateString)
      .eq("kind", "daily_complete")
      .maybeSingle();

    if (!existing) {
      await supabase.from("promise_progress_events").insert(event);
    }
  }
}

export async function emitStreakMilestoneIfReached(params: {
  activityId: string;
  activityName: string;
  streak: number;
  dateString: string;
}): Promise<void> {
  if (!supabase) return;
  const userId = getCachedUserId();
  if (!userId) return;

  const milestones = [7, 14, 30, 60, 90, 180, 365];
  if (!milestones.includes(params.streak)) return;

  const { data: matchingMemberships } = await supabase
    .from("promise_members")
    .select("promise_id")
    .eq("user_id", userId)
    .eq("member_activity_id", params.activityId)
    .eq("invite_status", "accepted");

  if (!matchingMemberships || matchingMemberships.length === 0) return;

  const promiseIds = matchingMemberships.map((m) => m.promise_id as string);
  const { data: activePromises } = await supabase
    .from("promises")
    .select("id")
    .in("id", promiseIds)
    .eq("status", "active");

  if (!activePromises || activePromises.length === 0) return;

  const payload: ProgressPayload = {
    activityName: params.activityName,
    streak: params.streak,
  };

  const ts = now();
  for (const p of activePromises) {
    const { data: existing } = await supabase
      .from("promise_progress_events")
      .select("id")
      .eq("promise_id", p.id)
      .eq("user_id", userId)
      .eq("date", params.dateString)
      .eq("kind", "streak_milestone")
      .maybeSingle();

    if (!existing) {
      await supabase.from("promise_progress_events").insert({
        id: newId(),
        promise_id: p.id as string,
        user_id: userId,
        date: params.dateString,
        kind: "streak_milestone",
        payload,
        created_at: ts,
      });
    }
  }
}
