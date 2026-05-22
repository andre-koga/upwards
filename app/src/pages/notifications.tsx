import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";

import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/promises/use-notifications";
import { useGoals } from "@/lib/promises/use-goals";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import type { InboxNotification } from "@/lib/promises/use-notifications";
import { NotificationRow } from "@/components/promises/notification-row";

export default function NotificationsPage() {
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
  } = useNotifications();
  const { acceptShare, declineShare, stopWatching } = useGoals();
  const { respond: respondFriend } = useFriends();
  const [responding, setResponding] = useState<string | null>(null);

  const handleAcceptFriend = async (id: string) => {
    setResponding(id);
    await respondFriend(id, true);
    await reload();
    setResponding(null);
  };

  const handleDeclineFriend = async (id: string) => {
    setResponding(id);
    await respondFriend(id, false);
    await reload();
    setResponding(null);
  };

  const handleAcceptGoalShare = async (n: InboxNotification) => {
    if (!n.shareId) return;
    const rawId = n.id.startsWith("gs-") ? n.id.slice(3) : n.shareId;
    setResponding(rawId);
    await acceptShare(n.shareId);
    await reload();
    setResponding(null);
  };

  const handleDeclineGoalShare = async (n: InboxNotification) => {
    if (!n.shareId) return;
    const rawId = n.id.startsWith("gs-") ? n.id.slice(3) : n.shareId;
    setResponding(rawId);
    await declineShare(n.shareId);
    await reload();
    setResponding(null);
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-2xl font-bold leading-none tracking-tight">
              <Bell className="h-6 w-6 shrink-0" />
              Notifications
            </h1>
            {isSupabaseConfigured && isAuthed && clearableCount > 0 && (
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
          <p className="text-sm text-muted-foreground">
            Friend requests, goal shares, and friends&apos; progress.
          </p>
        </div>
      </header>

      {!isSupabaseConfigured || !isAuthed ? (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Notifications require a sync account. Sign in from Settings.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/settings")}
          >
            Go to Settings
          </Button>
        </div>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Friend requests, goal shares, and progress updates will show up here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onAcceptFriend={(id) => void handleAcceptFriend(id)}
              onDeclineFriend={(id) => void handleDeclineFriend(id)}
              onAcceptGoalShare={(item) => void handleAcceptGoalShare(item)}
              onDeclineGoalShare={(item) => void handleDeclineGoalShare(item)}
              onStopWatchingGoalShare={(shareId) => {
                setResponding(shareId);
                void stopWatching(shareId).then(() => reload()).finally(() => setResponding(null));
              }}
              onDismiss={dismissNotification}
              responding={responding}
            />
          ))}
        </div>
      )}

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
