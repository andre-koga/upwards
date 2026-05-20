import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCachedUserId } from "@/lib/supabase";
import type { PromiseProgressEvent, PromiseReaction } from "@/lib/db/types";

export interface Notification {
  id: string;
  kind: "progress" | "reaction";
  created_at: string;
  promiseId: string;
  promiseTitle: string;
  fromDisplayName: string | null;
  /** progress-specific */
  progressEvent?: PromiseProgressEvent;
  /** reaction-specific */
  reaction?: PromiseReaction;
  reactionKind?: "motivate" | "congratulate";
}

export function usePromiseNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getCachedUserId();

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Promises I belong to
      const { data: memberRows } = await supabase
        .from("promise_members")
        .select("promise_id")
        .eq("user_id", userId)
        .eq("invite_status", "accepted");

      const promiseIds = (memberRows ?? []).map((r) => r.promise_id as string);
      if (promiseIds.length === 0) {
        setNotifications([]);
        return;
      }

      // Fetch promise titles
      const { data: promiseRows } = await supabase
        .from("promises")
        .select("id, title")
        .in("id", promiseIds);

      const titleById = new Map<string, string>(
        (promiseRows ?? []).map((p) => [p.id as string, p.title as string])
      );

      // Fetch member display names
      const { data: allMembers } = await supabase
        .from("promise_members")
        .select("user_id, display_name, promise_id")
        .in("promise_id", promiseIds);

      const displayNameByUser = new Map<string, string | null>();
      for (const m of allMembers ?? []) {
        if (!displayNameByUser.has(m.user_id)) {
          displayNameByUser.set(m.user_id, m.display_name ?? null);
        }
      }

      // Progress events from other members in my promises (last 7 days)
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await supabase
        .from("promise_progress_events")
        .select("*")
        .in("promise_id", promiseIds)
        .neq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);

      // Reactions sent TO me
      const { data: reactions } = await supabase
        .from("promise_reactions")
        .select("*")
        .eq("to_user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);

      const items: Notification[] = [
        ...((events ?? []) as PromiseProgressEvent[]).map((ev) => ({
          id: `evt-${ev.id}`,
          kind: "progress" as const,
          created_at: ev.created_at,
          promiseId: ev.promise_id,
          promiseTitle: titleById.get(ev.promise_id) ?? "Promise",
          fromDisplayName: displayNameByUser.get(ev.user_id) ?? null,
          progressEvent: ev,
        })),
        ...((reactions ?? []) as PromiseReaction[]).map((r) => ({
          id: `rxn-${r.id}`,
          kind: "reaction" as const,
          created_at: r.created_at,
          promiseId: r.promise_id,
          promiseTitle: titleById.get(r.promise_id) ?? "Promise",
          fromDisplayName: displayNameByUser.get(r.from_user_id) ?? null,
          reaction: r,
          reactionKind: r.kind,
        })),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(items);
    } catch (err) {
      console.error("[promises] failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating notifications from Supabase on mount */
    void load();
  }, [load]);

  const unreadCount = notifications.length;

  return { notifications, loading, reload: load, unreadCount };
}
