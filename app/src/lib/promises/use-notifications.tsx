/**
 * Unified notifications inbox.
 *
 * Inbox kinds:
 *   friend_request  — someone wants to be friends
 *   goal_share      — someone shared a goal with you (read-only cheer)
 *   goal_complete   — a friend completed their goal habit today
 *   goal_achieved   — a friend reached their goal target
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
import { buildGoalProgressSnapshot } from "@/lib/promises/notification-goal-snapshot";
import type { GoalTargetKind, ProgressPayload } from "@/lib/db/types";
import {
  dismissNotifications,
  fetchDismissedNotificationIds,
  isNotificationClearable,
  pruneDismissedNotifications,
} from "@/lib/promises/notification-dismissals";

export type NotificationKind =
  | "friend_request"
  | "goal_share"
  | "goal_complete"
  | "goal_achieved";

export interface InboxNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  goalId: string | null;
  shareId: string | null;
  activityName: string | null;
  goalLabel: string | null;
  goalTitle: string | null;
  goalDescription: string | null;
  actionStatus: "pending" | "accepted" | "declined" | null;
  createdAt: string;
  streak?: number;
  progressPercent?: number | null;
  targetReached?: boolean;
  periodEnded?: boolean;
  statusLabel?: string | null;
}

type ProfileRow = { username: string | null; display_name: string | null };

type PendingGoalShareRow = {
  share_id: string;
  goal_id: string;
  created_at: string;
  owner_user_id: string;
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

async function fetchPendingGoalShares(): Promise<PendingGoalShareRow[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_my_pending_goal_shares");
  if (error) {
    const userId = getCachedUserId();
    if (!userId) return [];
    const { data: shareRows, error: shareErr } = await supabase
      .from("goal_shares")
      .select("id, goal_id, owner_user_id, created_at")
      .eq("viewer_user_id", userId)
      .eq("status", "pending");
    if (shareErr) throw shareErr;
    return (shareRows ?? []).map((row) => ({
      share_id: row.id as string,
      goal_id: row.goal_id as string,
      created_at: row.created_at as string,
      owner_user_id: row.owner_user_id as string,
    }));
  }

  return (data ?? []) as PendingGoalShareRow[];
}

type GoalShareDetails = {
  name: string | null;
  description: string | null;
  target_kind: string | null;
  target_streak: number | null;
  target_end_date: string | null;
  activity_name: string | null;
  created_at: string;
  status: string;
};

function withGoalSnapshot(
  notification: InboxNotification,
  goalDetails: GoalShareDetails | undefined,
  streak: number | undefined,
  asOf: Date
): InboxNotification {
  const snapshot = buildGoalProgressSnapshot(
    goalDetails
      ? {
          target_kind: goalDetails.target_kind as GoalTargetKind | null,
          target_streak: goalDetails.target_streak,
          target_end_date: goalDetails.target_end_date,
          created_at: goalDetails.created_at,
          status: goalDetails.status as "active" | "completed" | "cancelled",
        }
      : undefined,
    streak,
    asOf
  );

  return {
    ...notification,
    streak: streak ?? notification.streak,
    progressPercent: snapshot.progressPercent,
    targetReached: snapshot.targetReached,
    periodEnded: snapshot.periodEnded,
    statusLabel: snapshot.statusLabel,
  };
}

async function fetchGoalDetails(
  goalIds: string[]
): Promise<Map<string, GoalShareDetails>> {
  const map = new Map<string, GoalShareDetails>();
  if (!supabase || goalIds.length === 0) return map;

  const { data, error } = await supabase
    .from("promises")
    .select(
      "id, name, description, target_kind, target_streak, target_end_date, activity_name, created_at, status"
    )
    .in("id", goalIds);
  if (error) throw error;

  for (const row of data ?? []) {
    map.set(row.id as string, {
      name: (row.name as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      target_kind: (row.target_kind as string | null) ?? null,
      target_streak: (row.target_streak as number | null) ?? null,
      target_end_date: (row.target_end_date as string | null) ?? null,
      activity_name: (row.activity_name as string | null) ?? null,
      created_at: row.created_at as string,
      status: row.status as string,
    });
  }
  return map;
}

async function fetchLatestActivityNamesByGoal(
  goalIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || goalIds.length === 0) return map;

  const { data, error } = await supabase
    .from("promise_progress_events")
    .select("promise_id, payload, created_at")
    .in("promise_id", goalIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  for (const row of data ?? []) {
    const goalId = row.promise_id as string;
    if (map.has(goalId)) continue;
    const activityName = (row.payload as Record<string, unknown> | null)
      ?.activityName;
    if (typeof activityName === "string" && activityName.trim()) {
      map.set(goalId, activityName.trim());
    }
  }
  return map;
}

function buildGoalShareNotification(
  share: PendingGoalShareRow,
  profile: ProfileRow | undefined,
  goalDetails: GoalShareDetails | undefined,
  activityNameFromProgress: string | undefined
): InboxNotification {
  const activityName =
    goalDetails?.activity_name?.trim() ||
    activityNameFromProgress ||
    null;

  const goalTitle = goalDetails?.name?.trim() || null;
  const goalDescription = goalDetails?.description?.trim() || null;

  return withGoalSnapshot(
    {
      id: `gs-${share.share_id}`,
      kind: "goal_share",
      actorId: share.owner_user_id,
      actorUsername: profile?.username ?? null,
      actorDisplayName: profile?.display_name ?? null,
      goalId: share.goal_id,
      shareId: share.share_id,
      activityName,
      goalLabel: goalDetails ? formatGoalTargetLabel(goalDetails) : null,
      goalTitle,
      goalDescription,
      actionStatus: "pending",
      createdAt: share.created_at,
    },
    goalDetails,
    0,
    new Date(share.created_at)
  );
}

interface NotificationsContextValue {
  notifications: InboxNotification[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  unreadCount: number;
  clearableCount: number;
  dismissNotification: (id: string) => void;
  dismissAllClearable: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  const [allNotifications, setAllNotifications] = useState<InboxNotification[]>(
    []
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = isAuthed ? getCachedUserId() : null;

  useEffect(() => {
    setDismissedIds(new Set());
  }, [userId]);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setAllNotifications([]);
      setDismissedIds(new Set());
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: friendReqs, error: frErr },
        goalShares,
        { data: watchingShares, error: wsErr },
        dismissedSet,
      ] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("id, from_user_id, status, created_at")
          .eq("to_user_id", userId)
          .eq("status", "pending"),
        fetchPendingGoalShares(),
        supabase
          .from("goal_shares")
          .select("id, goal_id")
          .eq("viewer_user_id", userId)
          .eq("status", "accepted"),
        fetchDismissedNotificationIds(userId),
      ]);

      if (frErr) throw frErr;
      if (wsErr) throw wsErr;

      const shareGoalIds = [
        ...new Set(goalShares.map((share) => share.goal_id)),
      ];
      const [goalDetailsById, activityNameByGoalId] = await Promise.all([
        fetchGoalDetails(shareGoalIds),
        fetchLatestActivityNamesByGoal(shareGoalIds),
      ]);

      const watchedGoalIds = (watchingShares ?? []).map(
        (row) => row.goal_id as string
      );
      const shareIdByGoalId = new Map(
        (watchingShares ?? []).map((row) => [row.goal_id as string, row.id as string])
      );

      const actorIds = [
        ...new Set([
          ...(friendReqs ?? []).map((r) => r.from_user_id as string),
          ...goalShares.map((gs) => gs.owner_user_id),
        ]),
      ];

      let completionItems: InboxNotification[] = [];

      if (watchedGoalIds.length > 0) {
        const { data: events, error: evErr } = await supabase
          .from("promise_progress_events")
          .select("id, promise_id, user_id, payload, created_at")
          .in("promise_id", watchedGoalIds)
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

        const completionGoalIds = [
          ...new Set((events ?? []).map((ev) => ev.promise_id as string)),
        ];
        const completionGoalDetails = await fetchGoalDetails(completionGoalIds);

        completionItems = (events ?? []).map((ev) => {
          const profile = profileMap.get(ev.user_id as string);
          const payload = (ev.payload as ProgressPayload | null) ?? {
            activityName: "",
          };
          const goalTargetReached = Boolean(payload.goalTargetReached);
          const goalDetails = completionGoalDetails.get(ev.promise_id as string);
          const promiseId = ev.promise_id as string;

          return withGoalSnapshot(
            {
              id: `gc-${ev.id as string}`,
              kind: (goalTargetReached
                ? "goal_achieved"
                : "goal_complete") as NotificationKind,
              actorId: ev.user_id as string,
              actorUsername: profile?.username ?? null,
              actorDisplayName: profile?.display_name ?? null,
              goalId: promiseId,
              shareId: shareIdByGoalId.get(promiseId) ?? null,
              activityName: payload.activityName ?? null,
              goalLabel: goalDetails ? formatGoalTargetLabel(goalDetails) : null,
              goalTitle: goalDetails?.name?.trim() ?? null,
              goalDescription: goalDetails?.description?.trim() ?? null,
              actionStatus: null,
              createdAt: ev.created_at as string,
              streak: payload.streak,
            },
            goalDetails,
            payload.streak,
            new Date(ev.created_at as string)
          );
        });
      }

      const profileMap =
        watchedGoalIds.length > 0
          ? await fetchProfiles(actorIds)
          : await fetchProfiles(actorIds);

      const friendReqItems: InboxNotification[] = (friendReqs ?? []).map((r) => {
        const profile = profileMap.get(r.from_user_id as string);
        return {
          id: `fr-${r.id as string}`,
          kind: "friend_request" as NotificationKind,
          actorId: r.from_user_id as string,
          actorUsername: profile?.username ?? null,
          actorDisplayName: profile?.display_name ?? null,
          goalId: null,
          shareId: null,
          activityName: null,
          goalLabel: null,
          goalTitle: null,
          goalDescription: null,
          actionStatus: "pending",
          createdAt: r.created_at as string,
        };
      });

      const goalShareItems: InboxNotification[] = goalShares.map((gs) =>
        buildGoalShareNotification(
          gs,
          profileMap.get(gs.owner_user_id),
          goalDetailsById.get(gs.goal_id),
          activityNameByGoalId.get(gs.goal_id)
        )
      );

      const inboxItems = [
        ...friendReqItems,
        ...goalShareItems,
        ...completionItems,
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setAllNotifications(inboxItems);
      setDismissedIds(dismissedSet);
      void pruneDismissedNotifications(
        userId,
        inboxItems.map((item) => item.id)
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
          table: "goal_shares",
          filter: `viewer_user_id=eq.${userId}`,
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "promise_progress_events",
        },
        () => {
          void load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "promise_progress_events",
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

  const notifications = useMemo(
    () => allNotifications.filter((n) => !dismissedIds.has(n.id)),
    [allNotifications, dismissedIds]
  );

  const unreadCount = notifications.length;

  const clearableCount = useMemo(
    () => notifications.filter(isNotificationClearable).length,
    [notifications]
  );

  const dismissNotification = useCallback(
    (id: string) => {
      if (!userId) return;
      const notification = allNotifications.find((n) => n.id === id);
      if (!notification || !isNotificationClearable(notification)) return;

      setDismissedIds((prev) => new Set([...prev, id]));
      void dismissNotifications(userId, [id]).catch(() => {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
    },
    [allNotifications, userId]
  );

  const dismissAllClearable = useCallback(() => {
    if (!userId) return;
    const clearableIds = notifications
      .filter(isNotificationClearable)
      .map((n) => n.id);
    if (clearableIds.length === 0) return;

    setDismissedIds((prev) => new Set([...prev, ...clearableIds]));
    void dismissNotifications(userId, clearableIds).catch(() => {
      void load();
    });
  }, [notifications, userId, load]);

  const value = useMemo(
    () => ({
      notifications,
      loading,
      error,
      reload: load,
      unreadCount,
      clearableCount,
      dismissNotification,
      dismissAllClearable,
    }),
    [
      notifications,
      loading,
      error,
      load,
      unreadCount,
      clearableCount,
      dismissNotification,
      dismissAllClearable,
    ]
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
