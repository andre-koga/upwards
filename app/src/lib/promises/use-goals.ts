import { useCallback, useEffect, useState } from "react";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { db, newId, now } from "@/lib/db";
import { isActiveActivity } from "@/lib/activity";
import type { Goal, GoalMember, GoalTargetInput, GoalWithMembers } from "@/lib/db/types";
import type { Activity } from "@/lib/db/types";

export function useGoals() {
  const [goals, setGoals] = useState<GoalWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = getCachedUserId();

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const { data: memberRows, error: mErr } = await supabase
        .from("promise_members")
        .select("promise_id")
        .eq("user_id", userId)
        .neq("invite_status", "declined");

      if (mErr) throw mErr;

      const promiseIds = [
        ...new Set((memberRows ?? []).map((r) => r.promise_id as string)),
      ];

      if (promiseIds.length === 0) {
        setGoals([]);
        setLoading(false);
        return;
      }

      const [{ data: goalRows, error: gErr }, { data: allMembers, error: amErr }] =
        await Promise.all([
          supabase
            .from("promises")
            .select("*")
            .in("id", promiseIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("promise_members")
            .select("*")
            .in("promise_id", promiseIds),
        ]);

      if (gErr) throw gErr;
      if (amErr) throw amErr;

      const membersByGoal = new Map<string, GoalMember[]>();
      for (const m of allMembers ?? []) {
        const list = membersByGoal.get(m.promise_id) ?? [];
        list.push(m as GoalMember);
        membersByGoal.set(m.promise_id, list);
      }

      setGoals(
        (goalRows ?? []).map((g) => ({
          ...(g as Goal),
          members: membersByGoal.get(g.id) ?? [],
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load();
  }, [load]);

  /** Create a new goal anchored to a local activity. */
  const createGoal = useCallback(
    async (activityId: string, target: GoalTargetInput): Promise<string> => {
      if (!supabase || !userId) throw new Error("Sign in to create goals");

      const goalId = newId();
      const ts = now();

      const targetFields =
        target.kind === "streak_count"
          ? { target_kind: "streak_count", target_streak: target.streak, target_end_date: null }
          : { target_kind: "streak_until", target_streak: null, target_end_date: target.endDate };

      const { error: gErr } = await supabase.from("promises").insert({
        id: goalId,
        creator_id: userId,
        creator_activity_id: activityId,
        status: "active",
        created_at: ts,
        completed_at: null,
        ...targetFields,
      });
      if (gErr) throw gErr;

      const { error: mErr } = await supabase.from("promise_members").insert({
        id: newId(),
        promise_id: goalId,
        user_id: userId,
        member_activity_id: activityId,
        invite_status: "accepted",
        joined_at: ts,
        created_at: ts,
        updated_at: ts,
      });
      if (mErr) throw mErr;

      await load();
      return goalId;
    },
    [userId, load]
  );

  /** Extend an active goal's target. Kind cannot switch; value must be strictly more ambitious. */
  const updateGoalTarget = useCallback(
    async (goalId: string, target: GoalTargetInput): Promise<void> => {
      if (!supabase) throw new Error("Not connected");

      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error("Goal not found");
      if (goal.target_kind !== target.kind) throw new Error("Cannot change goal kind");

      if (target.kind === "streak_count" && goal.target_streak != null) {
        if (target.streak <= goal.target_streak)
          throw new Error("New streak target must be higher than the current target");
      }
      if (target.kind === "streak_until" && goal.target_end_date != null) {
        if (target.endDate <= goal.target_end_date)
          throw new Error("New end date must be later than the current end date");
      }

      const patch =
        target.kind === "streak_count"
          ? { target_streak: target.streak }
          : { target_end_date: target.endDate };

      const { error } = await supabase.from("promises").update(patch).eq("id", goalId);
      if (error) throw error;
      await load();
    },
    [goals, load]
  );

  /** Invite a friend to a goal.
   *  friendActivityId = null means witness (no local habit needed). */
  const inviteFriend = useCallback(
    async (params: {
      goalId: string;
      friendUserId: string;
    }): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in to invite");
      const ts = now();

      const { error } = await supabase.from("promise_members").upsert(
        {
          id: newId(),
          promise_id: params.goalId,
          user_id: params.friendUserId,
          member_activity_id: null, // filled when they accept
          invite_status: "pending",
          joined_at: null,
          created_at: ts,
          updated_at: ts,
        },
        { onConflict: "promise_id,user_id", ignoreDuplicates: true }
      );
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  /** Accept a pending goal invite. Mutual = provide activityId; witness = omit. */
  const acceptGoalInvite = useCallback(
    async (params: { goalId: string; activityId?: string }): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const ts = now();

      const { error } = await supabase
        .from("promise_members")
        .update({
          invite_status: "accepted",
          member_activity_id: params.activityId ?? null,
          joined_at: ts,
          updated_at: ts,
        })
        .eq("promise_id", params.goalId)
        .eq("user_id", userId);
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  /** Decline a pending goal invite. */
  const declineGoalInvite = useCallback(
    async (goalId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const { error } = await supabase
        .from("promise_members")
        .update({ invite_status: "declined", updated_at: now() })
        .eq("promise_id", goalId)
        .eq("user_id", userId);
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  /** End a goal (completed or cancelled). Only the creator should call this. */
  const endGoal = useCallback(
    async (goalId: string, status: "completed" | "cancelled"): Promise<void> => {
      if (!supabase) return;
      const { error } = await supabase
        .from("promises")
        .update({
          status,
          completed_at: status === "completed" ? now() : null,
        })
        .eq("id", goalId);
      if (error) throw error;
      await load();
    },
    [load]
  );

  // Activities eligible to anchor a new goal
  const [eligibleActivities, setEligibleActivities] = useState<Activity[]>([]);
  useEffect(() => {
    db.activities
      .filter((a) => isActiveActivity(a))
      .toArray()
      .then((acts) => setEligibleActivities(acts))
      .catch(console.error);
  }, []);

  return {
    goals,
    loading,
    error,
    reload: load,
    createGoal,
    updateGoalTarget,
    inviteFriend,
    acceptGoalInvite,
    declineGoalInvite,
    endGoal,
    eligibleActivities,
    isSignedIn: Boolean(userId && supabase),
  };
}
