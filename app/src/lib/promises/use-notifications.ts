/**
 * Unified notifications inbox.
 *
 * Inbox kinds:
 *   friend_request  — someone wants to be friends
 *   goal_invite     — someone invited you to a goal
 *   goal_complete   — a partner completed a goal activity today
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, getCachedUserId } from "@/lib/supabase";

export type NotificationKind =
  | "friend_request"
  | "goal_invite"
  | "goal_complete";

export interface InboxNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  goalId: string | null;
  activityName: string | null;
  /** For friend_request and goal_invite: the status so the UI can show actions. */
  actionStatus: "pending" | "accepted" | "declined" | null;
  createdAt: string;
  /** Streak from payload, for goal_complete rows. */
  streak?: number;
}

type ProfileRow = { username: string | null; display_name: string | null };

async function fetchProfiles(
  userIds: string[]
): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>();
  if (!supabase || userIds.length === 0) return map;
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, username, display_name")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    map.set(row.user_id as string, {
      username: (row.username as string | null) ?? null,
      display_name: (row.display_name as string | null) ?? null,
    });
  }
  return map;
}

/** Supabase nested selects return an array or a single object — normalise. */
function creatorIdFromRelation(rel: unknown): string {
  if (Array.isArray(rel)) {
    const first = rel[0] as Record<string, unknown> | undefined;
    return (first?.creator_id as string) ?? "";
  }
  if (rel && typeof rel === "object") {
    return ((rel as Record<string, unknown>).creator_id as string) ?? "";
  }
  return "";
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
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
      setError(null);

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Friend requests to me (pending)
      const { data: friendReqs, error: frErr } = await supabase
        .from("friend_requests")
        .select("id, from_user_id, status, created_at")
        .eq("to_user_id", userId)
        .eq("status", "pending");
      if (frErr) throw frErr;

      // 2. Goal invites to me (pending member rows + related promise for creator_id)
      const { data: goalInvites, error: giErr } = await supabase
        .from("promise_members")
        .select("id, promise_id, invite_status, created_at, promises(creator_id)")
        .eq("user_id", userId)
        .eq("invite_status", "pending");
      if (giErr) throw giErr;

      // 3. Partner completions in goals I'm accepted in (last 7 days)
      const { data: myMemberships, error: mmErr } = await supabase
        .from("promise_members")
        .select("promise_id")
        .eq("user_id", userId)
        .eq("invite_status", "accepted");
      if (mmErr) throw mmErr;

      const myGoalIds = (myMemberships ?? []).map((m) => m.promise_id as string);

      // Collect actor ids for profile lookup
      const actorIds: string[] = [
        ...new Set([
          ...(friendReqs ?? []).map((r) => r.from_user_id as string),
          ...(goalInvites ?? []).map((gi) => creatorIdFromRelation(gi.promises)),
        ]),
      ];

      let completionItems: InboxNotification[] = [];

      if (myGoalIds.length > 0) {
        const { data: events, error: evErr } = await supabase
          .from("promise_progress_events")
          .select("id, promise_id, user_id, payload, created_at")
          .in("promise_id", myGoalIds)
          .neq("user_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(40);
        if (evErr) throw evErr;

        for (const ev of events ?? []) {
          if (!actorIds.includes(ev.user_id as string)) {
            actorIds.push(ev.user_id as string);
          }
        }

        const profileMap = await fetchProfiles(actorIds);

        completionItems = (events ?? []).map((ev) => {
          const profile = profileMap.get(ev.user_id as string);
          return {
            id: `gc-${ev.id as string}`,
            kind: "goal_complete" as NotificationKind,
            actorId: ev.user_id as string,
            actorUsername: profile?.username ?? null,
            actorDisplayName: profile?.display_name ?? null,
            goalId: ev.promise_id as string,
            activityName:
              ((ev.payload as Record<string, unknown>)?.activityName as string) ?? null,
            actionStatus: null,
            createdAt: ev.created_at as string,
            streak: (ev.payload as Record<string, unknown>)?.streak as number | undefined,
          };
        });

        const friendReqItems: InboxNotification[] = (friendReqs ?? []).map((r) => {
          const profile = profileMap.get(r.from_user_id as string);
          return {
            id: `fr-${r.id as string}`,
            kind: "friend_request" as NotificationKind,
            actorId: r.from_user_id as string,
            actorUsername: profile?.username ?? null,
            actorDisplayName: profile?.display_name ?? null,
            goalId: null,
            activityName: null,
            actionStatus: "pending",
            createdAt: r.created_at as string,
          };
        });

        const goalInviteItems: InboxNotification[] = (goalInvites ?? []).map((gi) => {
          const creatorId = creatorIdFromRelation(gi.promises);
          const profile = profileMap.get(creatorId);
          return {
            id: `gi-${gi.id as string}`,
            kind: "goal_invite" as NotificationKind,
            actorId: creatorId,
            actorUsername: profile?.username ?? null,
            actorDisplayName: profile?.display_name ?? null,
            goalId: gi.promise_id as string,
            activityName: null,
            actionStatus: "pending",
            createdAt: gi.created_at as string,
          };
        });

        const all = [
          ...friendReqItems,
          ...goalInviteItems,
          ...completionItems,
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(all);
        return;
      }

      // No active goals — just friend requests and goal invites
      const profileMap = await fetchProfiles(actorIds);

      const items: InboxNotification[] = [
        ...(friendReqs ?? []).map((r) => ({
          id: `fr-${r.id as string}`,
          kind: "friend_request" as NotificationKind,
          actorId: r.from_user_id as string,
          actorUsername: profileMap.get(r.from_user_id as string)?.username ?? null,
          actorDisplayName:
            profileMap.get(r.from_user_id as string)?.display_name ?? null,
          goalId: null,
          activityName: null,
          actionStatus: "pending" as const,
          createdAt: r.created_at as string,
        })),
        ...(goalInvites ?? []).map((gi) => {
          const creatorId = creatorIdFromRelation(gi.promises);
          return {
            id: `gi-${gi.id as string}`,
            kind: "goal_invite" as NotificationKind,
            actorId: creatorId,
            actorUsername: profileMap.get(creatorId)?.username ?? null,
            actorDisplayName: profileMap.get(creatorId)?.display_name ?? null,
            goalId: gi.promise_id as string,
            activityName: null,
            actionStatus: "pending" as const,
            createdAt: gi.created_at as string,
          };
        }),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notifications"
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load();
  }, [load]);

  const unreadCount = notifications.length;
  return { notifications, loading, error, reload: load, unreadCount };
}
