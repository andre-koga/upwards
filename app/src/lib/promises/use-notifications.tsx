/**
 * Unified notifications inbox.
 *
 * Inbox kinds:
 *   friend_request  — someone wants to be friends
 *   goal_invite     — someone invited you to a goal
 *   goal_complete   — a partner completed a goal activity today
 */
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
import { useAuth } from "@/lib/use-auth";
import { formatGoalTargetLabel } from "@/lib/promises/notification-labels";

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
  /** Human-readable target summary for goal invites. */
  goalLabel: string | null;
  /** For friend_request and goal_invite: the status so the UI can show actions. */
  actionStatus: "pending" | "accepted" | "declined" | null;
  createdAt: string;
  /** Streak from payload, for goal_complete rows. */
  streak?: number;
}

type ProfileRow = { username: string | null; display_name: string | null };

type PendingGoalInviteRow = {
  member_id: string;
  promise_id: string;
  created_at: string;
  creator_id: string;
};

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

async function fetchPendingGoalInvites(): Promise<PendingGoalInviteRow[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_my_pending_goal_invites");
  if (error) {
    // Fallback for environments that haven't applied the RPC migration yet.
    const { data: memberRows, error: memberErr } = await supabase
      .from("promise_members")
      .select("id, promise_id, invite_status, created_at")
      .eq("user_id", getCachedUserId() ?? "")
      .eq("invite_status", "pending");
    if (memberErr) throw memberErr;

    const promiseIds = [
      ...new Set((memberRows ?? []).map((row) => row.promise_id as string)),
    ];
    if (promiseIds.length === 0) return [];

    const { data: promiseRows, error: promiseErr } = await supabase
      .from("promises")
      .select("id, creator_id")
      .in("id", promiseIds);
    if (promiseErr) throw promiseErr;

    const creatorByPromiseId = new Map(
      (promiseRows ?? []).map((row) => [row.id as string, row.creator_id as string])
    );

    return (memberRows ?? []).flatMap((row) => {
      const creatorId = creatorByPromiseId.get(row.promise_id as string);
      if (!creatorId) return [];
      return [
        {
          member_id: row.id as string,
          promise_id: row.promise_id as string,
          created_at: row.created_at as string,
          creator_id: creatorId,
        },
      ];
    });
  }

  return (data ?? []) as PendingGoalInviteRow[];
}

type GoalInviteDetails = {
  target_kind: string | null;
  target_streak: number | null;
  target_end_date: string | null;
  creator_activity_name: string | null;
};

async function fetchGoalInviteDetails(
  promiseIds: string[]
): Promise<Map<string, GoalInviteDetails>> {
  const map = new Map<string, GoalInviteDetails>();
  if (!supabase || promiseIds.length === 0) return map;

  const { data, error } = await supabase
    .from("promises")
    .select("id, target_kind, target_streak, target_end_date, creator_activity_name")
    .in("id", promiseIds);
  if (error) throw error;

  for (const row of data ?? []) {
    map.set(row.id as string, {
      target_kind: (row.target_kind as string | null) ?? null,
      target_streak: (row.target_streak as number | null) ?? null,
      target_end_date: (row.target_end_date as string | null) ?? null,
      creator_activity_name: (row.creator_activity_name as string | null) ?? null,
    });
  }
  return map;
}

async function fetchLatestActivityNamesByPromise(
  promiseIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || promiseIds.length === 0) return map;

  const { data, error } = await supabase
    .from("promise_progress_events")
    .select("promise_id, payload, created_at")
    .in("promise_id", promiseIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  for (const row of data ?? []) {
    const promiseId = row.promise_id as string;
    if (map.has(promiseId)) continue;
    const activityName = (row.payload as Record<string, unknown> | null)
      ?.activityName;
    if (typeof activityName === "string" && activityName.trim()) {
      map.set(promiseId, activityName.trim());
    }
  }
  return map;
}

function buildGoalInviteNotification(
  gi: PendingGoalInviteRow,
  profile: ProfileRow | undefined,
  goalDetails: GoalInviteDetails | undefined,
  activityNameFromProgress: string | undefined
): InboxNotification {
  const activityName =
    goalDetails?.creator_activity_name?.trim() ||
    activityNameFromProgress ||
    null;

  return {
    id: `gi-${gi.member_id}`,
    kind: "goal_invite",
    actorId: gi.creator_id,
    actorUsername: profile?.username ?? null,
    actorDisplayName: profile?.display_name ?? null,
    goalId: gi.promise_id,
    activityName,
    goalLabel: goalDetails ? formatGoalTargetLabel(goalDetails) : null,
    actionStatus: "pending",
    createdAt: gi.created_at,
  };
}

interface NotificationsContextValue {
  notifications: InboxNotification[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  unreadCount: number;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = isAuthed ? getCachedUserId() : null;

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: friendReqs, error: frErr },
        goalInvites,
        { data: myMemberships, error: mmErr },
      ] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("id, from_user_id, status, created_at")
          .eq("to_user_id", userId)
          .eq("status", "pending"),
        fetchPendingGoalInvites(),
        supabase
          .from("promise_members")
          .select("promise_id")
          .eq("user_id", userId)
          .eq("invite_status", "accepted"),
      ]);

      if (frErr) throw frErr;
      if (mmErr) throw mmErr;

      const invitePromiseIds = [
        ...new Set(goalInvites.map((invite) => invite.promise_id)),
      ];
      const [goalDetailsById, activityNameByPromiseId] = await Promise.all([
        fetchGoalInviteDetails(invitePromiseIds),
        fetchLatestActivityNamesByPromise(invitePromiseIds),
      ]);

      const myGoalIds = (myMemberships ?? []).map((m) => m.promise_id as string);

      const actorIds = [
        ...new Set([
          ...(friendReqs ?? []).map((r) => r.from_user_id as string),
          ...goalInvites.map((gi) => gi.creator_id),
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
          const actorId = ev.user_id as string;
          if (!actorIds.includes(actorId)) {
            actorIds.push(actorId);
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
              ((ev.payload as Record<string, unknown>)?.activityName as string) ??
              null,
            goalLabel: null,
            actionStatus: null,
            createdAt: ev.created_at as string,
            streak: (ev.payload as Record<string, unknown>)?.streak as
              | number
              | undefined,
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
            goalLabel: null,
            actionStatus: "pending",
            createdAt: r.created_at as string,
          };
        });

        const goalInviteItems: InboxNotification[] = goalInvites.map((gi) =>
          buildGoalInviteNotification(
            gi,
            profileMap.get(gi.creator_id),
            goalDetailsById.get(gi.promise_id),
            activityNameByPromiseId.get(gi.promise_id)
          )
        );

        setNotifications(
          [...friendReqItems, ...goalInviteItems, ...completionItems].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        return;
      }

      const profileMap = await fetchProfiles(actorIds);

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
          goalLabel: null,
          actionStatus: "pending",
          createdAt: r.created_at as string,
        };
      });

      const goalInviteItems: InboxNotification[] = goalInvites.map((gi) =>
        buildGoalInviteNotification(
          gi,
          profileMap.get(gi.creator_id),
          goalDetailsById.get(gi.promise_id),
          activityNameByPromiseId.get(gi.promise_id)
        )
      );

      setNotifications(
        [...friendReqItems, ...goalInviteItems].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
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

  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "promise_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `to_user_id=eq.${userId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [userId, load]);

  const unreadCount = useMemo(
    () =>
      notifications.filter((n) => n.actionStatus === "pending").length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      loading,
      error,
      reload: load,
      unreadCount,
    }),
    [notifications, loading, error, load, unreadCount]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
