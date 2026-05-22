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
import { actorDisplayLabel } from "@/lib/promises/notification-labels";
import { GoalInviteAcceptDialog } from "@/components/promises/goal-invite-accept-dialog";
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
  } = useNotifications();
  const { declineGoalInvite } = useGoals();
  const { respond: respondFriend } = useFriends();
  const [responding, setResponding] = useState<string | null>(null);
  const [goalInviteAccept, setGoalInviteAccept] = useState<InboxNotification | null>(
    null
  );

  useEffect(() => {
    if (open) {
      void reload();
    }
  }, [open, reload]);

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

  const handleAcceptGoal = (n: InboxNotification) => {
    onOpenChange(false);
    setGoalInviteAccept(n);
  };

  const handleDeclineGoal = async (n: InboxNotification) => {
    if (!n.goalId) return;
    const rawId = n.id.startsWith("gi-") ? n.id.slice(3) : n.id;
    setResponding(rawId);
    await declineGoalInvite(n.goalId);
    await reload();
    setResponding(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[60] transition-all duration-300",
          open
            ? "pointer-events-auto bg-black/50 backdrop-blur-sm"
            : "bg-transparent backdrop-blur-0"
        )}
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer sliding down from top */}
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

          <div className="flex min-h-[35svh] max-h-[70svh] flex-col overflow-y-auto">
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
            ) : loading ? (
              <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : error ? (
              <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-destructive">
                {error}
              </p>
            ) : notifications.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                <Bell className="mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium">Nothing here yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Goal updates and friend requests will show up here.
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
                    onAcceptGoal={handleAcceptGoal}
                    onDeclineGoal={(item) => void handleDeclineGoal(item)}
                    onDismiss={dismissNotification}
                    responding={responding}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Drag handle hint */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      <GoalInviteAcceptDialog
        open={goalInviteAccept !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setGoalInviteAccept(null);
        }}
        goalId={goalInviteAccept?.goalId ?? null}
        inviterLabel={
          goalInviteAccept ? actorDisplayLabel(goalInviteAccept) : "Someone"
        }
        onAccepted={() => void reload()}
      />
    </>
  );
}
