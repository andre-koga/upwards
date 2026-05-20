import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCachedUserId } from "@/lib/supabase";
import { toDateString } from "@/lib/time-utils";

/** Per-activity partner completion status for today (mutual promise). */
export type PartnerStatus = {
  userId: string;
  displayName: string | null;
  completed: boolean;
};

/** Maps activityId → list of partner statuses for today. */
export type PartnerStatusMap = Record<string, PartnerStatus[]>;

export function usePartnerStatus(date: Date) {
  const [statusMap, setStatusMap] = useState<PartnerStatusMap>({});
  const userId = getCachedUserId();
  const dateString = toDateString(date);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;

    try {
      // Find all accepted memberships for my promises
      const { data: myMemberships } = await supabase
        .from("promise_members")
        .select("promise_id, member_activity_id")
        .eq("user_id", userId)
        .eq("invite_status", "accepted");

      if (!myMemberships || myMemberships.length === 0) return;

      const promiseIds = myMemberships.map((m) => m.promise_id as string);

      // Get all active promises I'm in
      const { data: activePromises } = await supabase
        .from("promises")
        .select("id, mode")
        .in("id", promiseIds)
        .eq("status", "active");

      const activeMutualIds = new Set(
        (activePromises ?? [])
          .filter((p) => p.mode === "mutual")
          .map((p) => p.id as string)
      );

      // Get all members in those mutual promises (excluding me)
      const { data: allMembers } = await supabase
        .from("promise_members")
        .select("promise_id, user_id, member_activity_id, display_name")
        .in("promise_id", Array.from(activeMutualIds))
        .neq("user_id", userId)
        .eq("invite_status", "accepted");

      if (!allMembers || allMembers.length === 0) return;

      // Get today's progress events from partners
      const partnerIds = [...new Set(allMembers.map((m) => m.user_id as string))];

      const { data: events } = await supabase
        .from("promise_progress_events")
        .select("promise_id, user_id")
        .in("promise_id", Array.from(activeMutualIds))
        .in("user_id", partnerIds)
        .eq("date", dateString)
        .eq("kind", "daily_complete");

      const completedSet = new Set(
        (events ?? []).map((e) => `${e.promise_id}|${e.user_id}`)
      );

      // Build activityId → partner statuses for my own activities
      const myActivityToPromise = new Map<string, string>();
      for (const m of myMemberships) {
        if (
          m.member_activity_id &&
          activeMutualIds.has(m.promise_id as string)
        ) {
          myActivityToPromise.set(
            m.member_activity_id as string,
            m.promise_id as string
          );
        }
      }

      const result: PartnerStatusMap = {};
      for (const [activityId, promiseId] of myActivityToPromise) {
        const partners = allMembers.filter(
          (m) => m.promise_id === promiseId && m.member_activity_id
        );
        result[activityId] = partners.map((p) => ({
          userId: p.user_id as string,
          displayName: (p.display_name as string | null) ?? null,
          completed: completedSet.has(`${promiseId}|${p.user_id}`),
        }));
      }

      setStatusMap(result);
    } catch (err) {
      console.error("[promises] partner status error:", err);
    }
  }, [userId, dateString]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating partner status from Supabase on date/auth change */
    void load();
  }, [load]);

  return { statusMap, reload: load };
}
