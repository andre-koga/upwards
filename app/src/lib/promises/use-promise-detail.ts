import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCachedUserId } from "@/lib/supabase";
import type {
  Promise as PromiseRecord,
  PromiseMember,
  PromiseProgressEvent,
  PromiseReaction,
  ReactionKind,
} from "@/lib/db/types";
import { newId, now } from "@/lib/db";

export interface PromiseDetail {
  promise: PromiseRecord;
  members: PromiseMember[];
  events: PromiseProgressEvent[];
  reactions: PromiseReaction[];
  myMembership: PromiseMember | null;
}

export function usePromiseDetail(promiseId: string | null) {
  const [detail, setDetail] = useState<PromiseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = getCachedUserId();

  const load = useCallback(async () => {
    if (!supabase || !promiseId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const [
        { data: promiseData, error: pErr },
        { data: members, error: mErr },
        { data: events, error: eErr },
        { data: reactions, error: rErr },
      ] = await Promise.all([
        supabase.from("promises").select("*").eq("id", promiseId).maybeSingle(),
        supabase
          .from("promise_members")
          .select("*")
          .eq("promise_id", promiseId),
        supabase
          .from("promise_progress_events")
          .select("*")
          .eq("promise_id", promiseId)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("promise_reactions")
          .select("*")
          .eq("promise_id", promiseId)
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
      ]);

      if (pErr) throw pErr;
      if (mErr) throw mErr;
      if (eErr) throw eErr;
      if (rErr) throw rErr;
      if (!promiseData) throw new Error("Promise not found");

      const memberList = (members ?? []) as PromiseMember[];
      setDetail({
        promise: promiseData as PromiseRecord,
        members: memberList,
        events: (events ?? []) as PromiseProgressEvent[],
        reactions: (reactions ?? []) as PromiseReaction[],
        myMembership:
          memberList.find((m) => m.user_id === userId) ?? null,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load promise details"
      );
    } finally {
      setLoading(false);
    }
  }, [promiseId, userId]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating remote promise detail on mount/id change */
    void load();
  }, [load]);

  const sendReaction = useCallback(
    async (toUserId: string, kind: ReactionKind, eventId?: string) => {
      if (!supabase || !promiseId || !userId) return;
      await supabase.from("promise_reactions").insert({
        id: newId(),
        promise_id: promiseId,
        from_user_id: userId,
        to_user_id: toUserId,
        progress_event_id: eventId ?? null,
        kind,
        created_at: now(),
      });
      await load();
    },
    [promiseId, userId, load]
  );

  return { detail, loading, error, reload: load, sendReaction };
}
