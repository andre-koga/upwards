import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { toDateString } from "@/lib/time-utils";
import type { GoalWithMembers, ProgressPayload } from "@/lib/db/types";

export type GoalMemberDayStatus = {
  userId: string;
  displayName: string | null;
  completed: boolean;
  isSelf: boolean;
  /** False for witnesses who joined without linking a habit. */
  hasLinkedHabit: boolean;
  /** Latest known streak from remote progress events (partners). */
  remoteStreak?: number;
};

export type GoalMemberStatusMap = Record<string, GoalMemberDayStatus[]>;

export function useGoalMemberStatus(
  date: Date,
  goals: GoalWithMembers[],
  refreshKey = 0
) {
  const [statusMap, setStatusMap] = useState<GoalMemberStatusMap>({});
  const [error, setError] = useState<string | null>(null);
  const userId = getCachedUserId();
  const dateString = toDateString(date);

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === "active"),
    [goals]
  );

  const load = useCallback(async () => {
    if (!supabase || !userId || activeGoals.length === 0) return;

    try {
      const goalIds = activeGoals.map((g) => g.id);

      const { data: dayEvents, error: dayErr } = await supabase
        .from("promise_progress_events")
        .select("promise_id, user_id")
        .in("promise_id", goalIds)
        .eq("date", dateString);

      if (dayErr) throw dayErr;

      const { data: streakEvents, error: streakErr } = await supabase
        .from("promise_progress_events")
        .select("promise_id, user_id, date, payload")
        .in("promise_id", goalIds)
        .lte("date", dateString)
        .order("date", { ascending: false });

      if (streakErr) throw streakErr;

      const completedSet = new Set(
        (dayEvents ?? []).map((e) => `${e.promise_id}|${e.user_id}`)
      );

      const remoteStreakByMember = new Map<string, number>();
      for (const event of streakEvents ?? []) {
        const key = `${event.promise_id}|${event.user_id}`;
        if (remoteStreakByMember.has(key)) continue;
        const payload = event.payload as ProgressPayload | null;
        if (typeof payload?.streak === "number") {
          remoteStreakByMember.set(key, payload.streak);
        }
      }

      const result: GoalMemberStatusMap = {};
      for (const goal of activeGoals) {
        const acceptedMembers = goal.members.filter(
          (m) => m.invite_status === "accepted"
        );
        if (acceptedMembers.length === 0) continue;

        result[goal.id] = acceptedMembers.map((m) => ({
          userId: m.user_id,
          displayName: m.display_name ?? m.username ?? null,
          completed: completedSet.has(`${goal.id}|${m.user_id}`),
          isSelf: m.user_id === userId,
          hasLinkedHabit: m.member_activity_id != null,
          remoteStreak: remoteStreakByMember.get(`${goal.id}|${m.user_id}`),
        }));
      }

      setStatusMap((prev) => ({ ...prev, ...result }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load goal member status"
      );
    }
  }, [userId, dateString, activeGoals, refreshKey]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load();
  }, [load]);

  return { statusMap, error, reload: load };
}
