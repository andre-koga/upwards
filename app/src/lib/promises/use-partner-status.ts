import { useCallback, useEffect, useState } from "react";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { toDateString } from "@/lib/time-utils";

/** Per-activity partner completion status for today. */
export type PartnerStatus = {
  userId: string;
  displayName: string | null;
  completed: boolean;
};

/** Maps activityId → list of partner statuses for the given date. */
export type PartnerStatusMap = Record<string, PartnerStatus[]>;

export function usePartnerStatus(date: Date) {
  const [statusMap, setStatusMap] = useState<PartnerStatusMap>({});
  const [error, setError] = useState<string | null>(null);
  const userId = getCachedUserId();
  const dateString = toDateString(date);

  const load = useCallback(async () => {
    // Always reset first so stale data never shows after leaving a goal
    setStatusMap({});
    if (!supabase || !userId) return;

    try {
      // My accepted memberships with a linked activity (mutual only)
      const { data: myMemberships, error: mmErr } = await supabase
        .from("promise_members")
        .select("promise_id, member_activity_id")
        .eq("user_id", userId)
        .eq("invite_status", "accepted")
        .not("member_activity_id", "is", null);

      if (mmErr) throw mmErr;
      if (!myMemberships || myMemberships.length === 0) return;

      const promiseIds = myMemberships.map((m) => m.promise_id as string);

      // Only active goals
      const { data: activeGoals, error: agErr } = await supabase
        .from("promises")
        .select("id")
        .in("id", promiseIds)
        .eq("status", "active");

      if (agErr) throw agErr;
      if (!activeGoals || activeGoals.length === 0) return;

      const activeIds = new Set(activeGoals.map((g) => g.id as string));

      // Other members in those goals who have a linked activity
      const { data: partners, error: pErr } = await supabase
        .from("promise_members")
        .select("promise_id, user_id, member_activity_id")
        .in("promise_id", Array.from(activeIds))
        .neq("user_id", userId)
        .eq("invite_status", "accepted")
        .not("member_activity_id", "is", null);

      if (pErr) throw pErr;
      if (!partners || partners.length === 0) return;

      const partnerIds = [...new Set(partners.map((p) => p.user_id as string))];

      // Today's completions from those partners
      const { data: events, error: evErr } = await supabase
        .from("promise_progress_events")
        .select("promise_id, user_id")
        .in("promise_id", Array.from(activeIds))
        .in("user_id", partnerIds)
        .eq("date", dateString);

      if (evErr) throw evErr;

      const completedSet = new Set(
        (events ?? []).map((e) => `${e.promise_id}|${e.user_id}`)
      );

      // Fetch display names / usernames for partners
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, username, display_name")
        .in("user_id", partnerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.user_id as string,
          { username: p.username as string | null, display_name: p.display_name as string | null },
        ])
      );

      // Build activityId → partner statuses (for MY activities in mutual goals)
      const myActivityToGoal = new Map<string, string>();
      for (const m of myMemberships) {
        if (m.member_activity_id && activeIds.has(m.promise_id as string)) {
          myActivityToGoal.set(m.member_activity_id as string, m.promise_id as string);
        }
      }

      const result: PartnerStatusMap = {};
      for (const [activityId, goalId] of myActivityToGoal) {
        const goalPartners = partners.filter(
          (p) => p.promise_id === goalId && p.member_activity_id
        );
        if (goalPartners.length === 0) continue;
        result[activityId] = goalPartners.map((p) => {
          const profile = profileMap.get(p.user_id as string);
          return {
            userId: p.user_id as string,
            displayName:
              profile?.display_name ?? profile?.username ?? null,
            completed: completedSet.has(`${goalId}|${p.user_id}`),
          };
        });
      }

      setStatusMap(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load partner status");
    }
  }, [userId, dateString]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load();
  }, [load]);

  return { statusMap, error, reload: load };
}
