/**
 * Unified notifications inbox: friend requests (+ legacy activity_complete kind).
 */
import {
  useCallback,
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
import { NotificationsContext } from "@/lib/notifications/notifications-context";
import type {
  InboxNotification,
  LoadNotificationsOptions,
} from "@/lib/notifications/notification-inbox-types";

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

  const [prevUserId, setPrevUserId] = useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setDismissedIds(new Set());
    setSuppressedIds(new Set());
  }

  const load = useCallback(
    async (options?: LoadNotificationsOptions) => {
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

        const [{ data: friendReqs, error: frErr }, dismissedSet] =
          await Promise.all([
            supabase
              .from("friend_requests")
              .select("id, from_user_id, status, created_at")
              .eq("to_user_id", userId)
              .eq("status", "pending"),
            fetchDismissedNotificationIds(userId),
          ]);

        if (frErr) throw frErr;

        const actorIds = [
          ...new Set((friendReqs ?? []).map((r) => r.from_user_id as string)),
        ];
        const profiles = await fetchProfiles(actorIds);

        const friendItems: InboxNotification[] = (friendReqs ?? []).map(
          (row) => {
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
          }
        );

        const merged = [...friendItems].sort(
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
        setError(
          err instanceof Error ? err.message : "Failed to load notifications"
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => load())
      .catch(() => {
        if (!cancelled) {
          // load() already logs errors
        }
      });
    return () => {
      cancelled = true;
    };
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
    const ids = notifications.filter(isNotificationClearable).map((n) => n.id);
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
