/**
 * Unified notifications inbox: friend requests + shared habit completions.
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
import {
  dismissNotifications,
  fetchDismissedNotificationIds,
  isNotificationClearable,
  pruneDismissedNotifications,
} from "@/lib/notifications/notification-dismissals";
import { matchesFriendRequestNotification } from "@/lib/notifications/notification-inbox-utils";

export type NotificationKind = "friend_request" | "activity_complete";

export interface InboxNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  activityName: string | null;
  actionStatus: "pending" | "accepted" | "declined" | null;
  createdAt: string;
  streak?: number;
  milestonePrev?: number;
  milestoneNext?: number;
  progressPercent?: number;
  routine?: string | null;
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

function friendIdsFromRows(
  userId: string,
  rows: { user_a: string; user_b: string }[]
): string[] {
  return rows.map((row) =>
    row.user_a === userId ? row.user_b : row.user_a
  );
}

function milestoneProgressPercent(
  streak: number,
  prev: number,
  next: number
): number {
  const span = next - prev;
  if (span <= 0) return 100;
  return Math.min(100, Math.round(((streak - prev) / span) * 100));
}

export type LoadNotificationsOptions = {
  silent?: boolean;
};

interface NotificationsContextValue {
  notifications: InboxNotification[];
  loading: boolean;
  error: string | null;
  reload: (options?: LoadNotificationsOptions) => Promise<void>;
  unreadCount: number;
  clearableCount: number;
  dismissNotification: (id: string) => void;
  dismissAllClearable: () => void;
  removeNotificationsMatching: (
    match: (notification: InboxNotification) => boolean
  ) => void;
  dismissNotificationIds: (ids: string[]) => void;
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
  const [suppressedIds, setSuppressedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = isAuthed ? getCachedUserId() : null;

  useEffect(() => {
    setDismissedIds(new Set());
    setSuppressedIds(new Set());
  }, [userId]);

  const load = useCallback(async (options?: LoadNotificationsOptions) => {
    if (!supabase || !userId) {
      setAllNotifications([]);
      setDismissedIds(new Set());
      setLoading(false);
      return;
    }
    const silent = options?.silent ?? false;
    try {
      if (!silent) setLoading(true);
      setError(null);

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: friendReqs, error: frErr },
        { data: friendships, error: fsErr },
        dismissedSet,
      ] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("id, from_user_id, status, created_at")
          .eq("to_user_id", userId)
          .eq("status", "pending"),
        supabase
          .from("friendships")
          .select("user_a, user_b")
          .or(`user_a.eq.${userId},user_b.eq.${userId}`),
        fetchDismissedNotificationIds(userId),
      ]);

      if (frErr) throw frErr;
      if (fsErr) throw fsErr;

      const friendIds = friendIdsFromRows(
        userId,
        (friendships ?? []) as { user_a: string; user_b: string }[]
      );

      let completionItems: InboxNotification[] = [];
      if (friendIds.length > 0) {
        const { data: completions, error: compErr } = await supabase
          .from("friend_activity_completions")
          .select(
            "id, user_id, activity_name, streak, milestone_prev, milestone_next, routine, created_at"
          )
          .in("user_id", friendIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false });
        if (compErr) throw compErr;

        completionItems = (completions ?? []).map((row) => {
          const streak = (row.streak as number) ?? 0;
          const prev = (row.milestone_prev as number) ?? 0;
          const next = (row.milestone_next as number) ?? 1;
          return {
            id: `ac-${row.id as string}`,
            kind: "activity_complete" as const,
            actorId: row.user_id as string,
            actorUsername: null,
            actorDisplayName: null,
            activityName: (row.activity_name as string) ?? null,
            actionStatus: null,
            createdAt: row.created_at as string,
            streak,
            milestonePrev: prev,
            milestoneNext: next,
            progressPercent: milestoneProgressPercent(streak, prev, next),
            routine: (row.routine as string | null) ?? null,
          };
        });
      }

      const actorIds = [
        ...new Set([
          ...(friendReqs ?? []).map((r) => r.from_user_id as string),
          ...completionItems.map((n) => n.actorId),
        ]),
      ];
      const profiles = await fetchProfiles(actorIds);

      const friendItems: InboxNotification[] = (friendReqs ?? []).map((row) => {
        const fromId = row.from_user_id as string;
        const profile = profiles.get(fromId);
        return {
          id: `fr-${row.id as string}`,
          kind: "friend_request",
          actorId: fromId,
          actorUsername: profile?.username ?? null,
          actorDisplayName: profile?.display_name ?? null,
          activityName: null,
          actionStatus: "pending",
          createdAt: row.created_at as string,
        };
      });

      completionItems = completionItems.map((n) => {
        const profile = profiles.get(n.actorId);
        return {
          ...n,
          actorUsername: profile?.username ?? null,
          actorDisplayName: profile?.display_name ?? null,
        };
      });

      const merged = [...friendItems, ...completionItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setAllNotifications(merged);
      setDismissedIds(dismissedSet);
      void pruneDismissedNotifications(
        userId,
        merged.map((n) => n.id)
      );
    } catch (err) {
      console.error("[notifications] load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const notifications = useMemo(
    () =>
      allNotifications.filter(
        (n) => !dismissedIds.has(n.id) && !suppressedIds.has(n.id)
      ),
    [allNotifications, dismissedIds, suppressedIds]
  );

  const unreadCount = notifications.length;
  const clearableCount = notifications.filter(isNotificationClearable).length;

  const dismissNotification = useCallback(
    (id: string) => {
      if (!userId) return;
      setDismissedIds((prev) => new Set(prev).add(id));
      void dismissNotifications(userId, [id]);
    },
    [userId]
  );

  const dismissAllClearable = useCallback(() => {
    if (!userId) return;
    const ids = notifications
      .filter(isNotificationClearable)
      .map((n) => n.id);
    if (ids.length === 0) return;
    setDismissedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    void dismissNotifications(userId, ids);
  }, [notifications, userId]);

  const removeNotificationsMatching = useCallback(
    (match: (notification: InboxNotification) => boolean) => {
      setSuppressedIds((prev) => {
        const next = new Set(prev);
        allNotifications.filter(match).forEach((n) => next.add(n.id));
        return next;
      });
      setAllNotifications((prev) => prev.filter((n) => !match(n)));
    },
    [allNotifications]
  );

  const dismissNotificationIds = useCallback(
    (ids: string[]) => {
      if (!userId || ids.length === 0) return;
      setDismissedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      void dismissNotifications(userId, ids);
    },
    [userId]
  );

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
      removeNotificationsMatching,
      dismissNotificationIds,
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
      removeNotificationsMatching,
      dismissNotificationIds,
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

export { matchesFriendRequestNotification };
