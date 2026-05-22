import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { db, newId, now } from "@/lib/db";
import {
  isActiveGroup,
  buildGroupById,
  filterActiveActivities,
  getActivityDisplayName,
} from "@/lib/activity";
import { fetchUserProfiles } from "@/lib/friends/use-friends";
import {
  activityHasActiveGoal,
  filterActivitiesWithoutActiveGoals,
} from "@/lib/promises/goal-eligibility";
import {
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_NAME_MAX_LENGTH,
} from "@/lib/promises/goal-display";
import { emitGoalTargetReached } from "@/lib/promises/emit-progress";
import { attachShares, mapGoalRow, mapShareRow } from "@/lib/promises/goal-mapper";
import { toDateString } from "@/lib/time-utils";
import type {
  Activity,
  CreateGoalInput,
  Goal,
  GoalShare,
  GoalTargetInput,
  GoalWithShares,
} from "@/lib/db/types";

interface GoalsContextValue {
  ownedGoals: GoalWithShares[];
  /** @deprecated Use ownedGoals — kept for gradual migration */
  goals: GoalWithShares[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createGoal: (input: CreateGoalInput) => Promise<string>;
  extendGoal: (goalId: string, target: GoalTargetInput) => Promise<void>;
  completeGoal: (goalId: string) => Promise<void>;
  cancelGoal: (goalId: string) => Promise<void>;
  shareGoal: (goalId: string, friendUserId: string) => Promise<void>;
  unshareGoal: (shareId: string) => Promise<void>;
  acceptShare: (shareId: string) => Promise<void>;
  declineShare: (shareId: string) => Promise<void>;
  stopWatching: (shareId: string) => Promise<void>;
  eligibleActivities: Activity[];
  isSignedIn: boolean;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [ownedGoals, setOwnedGoals] = useState<GoalWithShares[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eligibleActivities, setEligibleActivities] = useState<Activity[]>([]);
  const userId = getCachedUserId();

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setOwnedGoals([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const { data: ownedRows, error: ownedErr } = await supabase
        .from("promises")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (ownedErr) throw ownedErr;

      const ownedIds = (ownedRows ?? []).map((r) => r.id as string);

      let sharesForOwned: GoalShare[] = [];
      if (ownedIds.length > 0) {
        const { data: shareRows, error: shareErr } = await supabase
          .from("goal_shares")
          .select("*")
          .in("goal_id", ownedIds);
        if (shareErr) throw shareErr;
        const viewerIds = [
          ...new Set((shareRows ?? []).map((s) => s.viewer_user_id as string)),
        ];
        const profiles = await fetchUserProfiles(viewerIds);
        sharesForOwned = (shareRows ?? []).map((row) => {
          const share = mapShareRow(row as Record<string, unknown>);
          const profile = profiles.get(share.viewer_user_id);
          return {
            ...share,
            username: profile?.username ?? null,
            display_name: profile?.displayName ?? null,
          };
        });
      }

      const sharesByGoal = new Map<string, GoalShare[]>();
      for (const share of sharesForOwned) {
        const list = sharesByGoal.get(share.goal_id) ?? [];
        list.push(share);
        sharesByGoal.set(share.goal_id, list);
      }

      const owned = (ownedRows ?? []).map((row) =>
        attachShares(mapGoalRow(row as Record<string, unknown>), sharesByGoal.get(row.id as string) ?? [])
      );
      setOwnedGoals(owned);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      db.activities.filter((a) => !a.completed_at && !a.deleted_at).toArray(),
      db.activityGroups.filter((g) => isActiveGroup(g)).toArray(),
    ])
      .then(([acts, groups]) => {
        const groupById = buildGroupById(groups);
        const active = filterActiveActivities(acts, groupById);
        setEligibleActivities(
          filterActivitiesWithoutActiveGoals(active, ownedGoals, userId) as Activity[]
        );
      })
      .catch(console.error);
  }, [ownedGoals, userId]);

  const createGoal = useCallback(
    async (input: CreateGoalInput): Promise<string> => {
      if (!supabase || !userId) throw new Error("Sign in to create goals");

      const name = input.name.trim();
      const description = input.description.trim();
      if (!name) throw new Error("Goal name is required.");
      if (name.length > GOAL_NAME_MAX_LENGTH) {
        throw new Error(`Goal name must be ${GOAL_NAME_MAX_LENGTH} characters or less.`);
      }
      if (!description) throw new Error("Goal description is required.");
      if (description.length > GOAL_DESCRIPTION_MAX_LENGTH) {
        throw new Error(
          `Goal description must be ${GOAL_DESCRIPTION_MAX_LENGTH} characters or less.`
        );
      }
      if (activityHasActiveGoal(input.activityId, ownedGoals, userId)) {
        throw new Error("This habit already has an active Goal.");
      }

      const goalId = newId();
      const ts = now();
      const targetFields =
        input.target.kind === "streak_count"
          ? {
              target_kind: "streak_count" as const,
              target_streak: input.target.streak,
              target_end_date: null,
            }
          : {
              target_kind: "streak_until" as const,
              target_streak: null,
              target_end_date: input.target.endDate,
            };

      const activity = await db.activities.get(input.activityId);
      const group = activity
        ? await db.activityGroups.get(activity.group_id)
        : undefined;
      const activityName = activity
        ? getActivityDisplayName(activity, group)
        : null;

      const { error: gErr } = await supabase.from("promises").insert({
        id: goalId,
        user_id: userId,
        activity_id: input.activityId,
        activity_name: activityName,
        name,
        description,
        status: "active",
        created_at: ts,
        completed_at: null,
        ...targetFields,
      });
      if (gErr) throw gErr;
      await load();
      return goalId;
    },
    [userId, load, ownedGoals]
  );

  const extendGoal = useCallback(
    async (goalId: string, target: GoalTargetInput): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");

      const goal = ownedGoals.find((g) => g.id === goalId);
      if (!goal) throw new Error("Goal not found");
      if (goal.user_id !== userId) throw new Error("Not your goal");
      if (goal.target_kind !== target.kind) throw new Error("Cannot change goal kind");

      if (target.kind === "streak_count" && goal.target_streak != null) {
        if (target.streak <= goal.target_streak) {
          throw new Error("New streak target must be higher than the current target");
        }
      }
      if (target.kind === "streak_until" && goal.target_end_date != null) {
        if (target.endDate <= goal.target_end_date) {
          throw new Error("New end date must be later than the current end date");
        }
      }

      const patch =
        target.kind === "streak_count"
          ? { target_streak: target.streak }
          : { target_end_date: target.endDate };

      const { error } = await supabase.from("promises").update(patch).eq("id", goalId);
      if (error) throw error;
      await load();
    },
    [ownedGoals, userId, load]
  );

  const completeGoal = useCallback(
    async (goalId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const goal = ownedGoals.find((g) => g.id === goalId);
      if (!goal || goal.user_id !== userId) throw new Error("Goal not found");

      const ts = now();
      const { error } = await supabase
        .from("promises")
        .update({ status: "completed", completed_at: ts })
        .eq("id", goalId);
      if (error) throw error;

      let streak = 0;
      const activityName = goal.activity_name ?? "their habit";
      if (goal.activity_id) {
        const streakRows = await db.activityStreaks
          .where("activity_id")
          .equals(goal.activity_id)
          .reverse()
          .sortBy("date");
        streak = streakRows[0]?.streak ?? 0;
      }

      await emitGoalTargetReached({
        goalId,
        activityName,
        streak,
        dateString: toDateString(new Date()),
      });
      await load();
    },
    [ownedGoals, userId, load]
  );

  const cancelGoal = useCallback(
    async (goalId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const { error } = await supabase
        .from("promises")
        .update({ status: "cancelled", completed_at: null })
        .eq("id", goalId)
        .eq("user_id", userId);
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  const shareGoal = useCallback(
    async (goalId: string, friendUserId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const goal = ownedGoals.find((g) => g.id === goalId);
      if (!goal || goal.user_id !== userId) throw new Error("Goal not found");

      const ts = now();
      const { data: existing, error: findErr } = await supabase
        .from("goal_shares")
        .select("id")
        .eq("goal_id", goalId)
        .eq("viewer_user_id", friendUserId)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing?.id) {
        const { error } = await supabase
          .from("goal_shares")
          .update({ status: "pending", responded_at: null, created_at: ts })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goal_shares").insert({
          id: newId(),
          goal_id: goalId,
          owner_user_id: userId,
          viewer_user_id: friendUserId,
          status: "pending",
          created_at: ts,
        });
        if (error) throw error;
      }
      await load();
    },
    [ownedGoals, userId, load]
  );

  const unshareGoal = useCallback(
    async (shareId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const { error } = await supabase
        .from("goal_shares")
        .delete()
        .eq("id", shareId)
        .eq("owner_user_id", userId);
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  const acceptShare = useCallback(
    async (shareId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const ts = now();
      const { error } = await supabase
        .from("goal_shares")
        .update({ status: "accepted", responded_at: ts })
        .eq("id", shareId)
        .eq("viewer_user_id", userId);
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  const declineShare = useCallback(
    async (shareId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const ts = now();
      const { error } = await supabase
        .from("goal_shares")
        .update({ status: "declined", responded_at: ts })
        .eq("id", shareId)
        .eq("viewer_user_id", userId);
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  const stopWatching = useCallback(
    async (shareId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error("Sign in");
      const ts = now();
      const { error } = await supabase
        .from("goal_shares")
        .update({ status: "stopped", responded_at: ts })
        .eq("id", shareId)
        .eq("viewer_user_id", userId);
      if (error) throw error;
      await load();
    },
    [userId, load]
  );

  const value = useMemo(
    () => ({
      ownedGoals,
      goals: ownedGoals,
      loading,
      error,
      reload: load,
      createGoal,
      extendGoal,
      completeGoal,
      cancelGoal,
      shareGoal,
      unshareGoal,
      acceptShare,
      declineShare,
      stopWatching,
      eligibleActivities,
      isSignedIn: Boolean(userId && supabase),
    }),
    [
      ownedGoals,
      loading,
      error,
      load,
      createGoal,
      extendGoal,
      completeGoal,
      cancelGoal,
      shareGoal,
      unshareGoal,
      acceptShare,
      declineShare,
      stopWatching,
      eligibleActivities,
      userId,
    ]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals(): GoalsContextValue {
  const ctx = useContext(GoalsContext);
  if (!ctx) {
    throw new Error("useGoals must be used within GoalsProvider");
  }
  return ctx;
}
