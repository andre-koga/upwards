import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/promises/use-notifications";
import { useGoals } from "@/lib/promises/use-goals";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import type { InboxNotification } from "@/lib/promises/use-notifications";
import {
  clearableNotificationIdsForShare,
  matchesFriendRequestNotification,
  matchesGoalShareNotification,
} from "@/lib/promises/notification-inbox-utils";
import { NotificationRow } from "@/components/promises/notification-row";

interface NotificationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsDrawer({ open, onOpenChange }: NotificationsDrawerProps) {
  const navigate = useNavigate();
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const {
    notifications,
    loading,
    error,
    reload,
    clearableCount,
    dismissNotification,
    dismissAllClearable,
    removeNotificationsMatching,
    dismissNotificationIds,
  } = useNotifications();
  const { acceptShare, declineShare, stopWatching } = useGoals();
  const { respond: respondFriend } = useFriends();
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void reload({ silent: true });
    }
  }, [open, reload]);

  const handleAcceptFriend = async (id: string) => {
    setResponding(id);
    removeNotificationsMatching((n) => matchesFriendRequestNotification(n, id));
    try {
      await respondFriend(id, true);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  const handleDeclineFriend = async (id: string) => {
    setResponding(id);
    removeNotificationsMatching((n) => matchesFriendRequestNotification(n, id));
    try {
      await respondFriend(id, false);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  const handleAcceptGoalShare = async (n: InboxNotification) => {
    if (!n.shareId) return;
    const rawId = n.id.startsWith("gs-") ? n.id.slice(3) : n.shareId;
    setResponding(rawId);
    removeNotificationsMatching((item) => item.id === n.id);
    try {
      await acceptShare(n.shareId);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  const handleDeclineGoalShare = async (n: InboxNotification) => {
    if (!n.shareId) return;
    const rawId = n.id.startsWith("gs-") ? n.id.slice(3) : n.shareId;
    setResponding(rawId);
    removeNotificationsMatching((item) => item.id === n.id);
    try {
      await declineShare(n.shareId);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  const handleStopWatching = async (shareId: string) => {
    setResponding(shareId);
    const clearableIds = clearableNotificationIdsForShare(notifications, shareId);
    removeNotificationsMatching((n) => matchesGoalShareNotification(n, shareId));
    if (clearableIds.length > 0) {
      dismissNotificationIds(clearableIds);
    }
    try {
      await stopWatching(shareId);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[60] transition-all duration-300",
          open
            ? "pointer-events-auto bg-black/50 backdrop-blur-sm"
            : "bg-transparent backdrop-blur-0"
        )}
        onClick={() => onOpenChange(false)}
      />

      <div
        className={cn(
          "fixed inset-x-0 top-0 z-[70] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="rounded-b-2xl border-b border-border bg-background shadow-xl pt-2">
          {isSupabaseConfigured && isAuthed && (
            <div className="flex h-11 items-center justify-between gap-3 border-b border-border px-4">
              <span className="text-sm font-semibold leading-none">
                Notifications
              </span>
              {clearableCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 px-2 text-xs text-muted-foreground"
                  onClick={dismissAllClearable}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}

          <div className="flex max-h-[70svh] flex-col overflow-y-auto">
            {!isSupabaseConfigured || !isAuthed ? (
              <div className="flex flex-1 flex-col justify-center space-y-3 p-4">
                <p className="text-sm text-muted-foreground">
                  Notifications require a sync account. Sign in from Settings.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/settings");
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            ) : loading && notifications.length === 0 ? (
              <p className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
                Loading…
              </p>
            ) : error ? (
              <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-destructive">
                {error}
              </p>
            ) : notifications.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-2 text-center">
                <Bell className="m-2 h-6 w-6 text-muted-foreground/30" />
                <p className="text-sm font-medium">Nothing here yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Goal shares and friend requests will show up here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onAcceptFriend={(id) => void handleAcceptFriend(id)}
                    onDeclineFriend={(id) => void handleDeclineFriend(id)}
                    onAcceptGoalShare={(item) => void handleAcceptGoalShare(item)}
                    onDeclineGoalShare={(item) => void handleDeclineGoalShare(item)}
                    onStopWatchingGoalShare={(shareId) => void handleStopWatching(shareId)}
                    onDismiss={dismissNotification}
                    responding={responding}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </>
  );
}
