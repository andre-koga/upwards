import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle2, XCircle, Flame, Users, Target } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/promises/use-notifications";
import { useGoals } from "@/lib/promises/use-goals";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import type { InboxNotification } from "@/lib/promises/use-notifications";

function actorLabel(n: InboxNotification): string {
  if (n.actorDisplayName && n.actorUsername)
    return `${n.actorDisplayName} (@${n.actorUsername})`;
  if (n.actorUsername) return `@${n.actorUsername}`;
  if (n.actorDisplayName) return n.actorDisplayName;
  return "Someone";
}

function NotificationRow({
  n,
  onAcceptFriend,
  onDeclineFriend,
  onAcceptGoal,
  onDeclineGoal,
  onClose,
  responding,
}: {
  n: InboxNotification;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onAcceptGoal: (notification: InboxNotification) => void;
  onDeclineGoal: (n: InboxNotification) => void;
  onClose: () => void;
  responding: string | null;
}) {
  const navigate = useNavigate();

  const rawId = n.id.startsWith("fr-")
    ? n.id.slice(3)
    : n.id.startsWith("gi-")
      ? n.id.slice(3)
      : n.id;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0">
        {n.kind === "friend_request" && (
          <Users className="h-4 w-4 text-blue-500" />
        )}
        {n.kind === "goal_invite" && (
          <Target className="h-4 w-4 text-primary" />
        )}
        {n.kind === "goal_complete" && n.streak && n.streak >= 7 ? (
          <Flame className="h-4 w-4 text-orange-500" />
        ) : n.kind === "goal_complete" ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : null}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{actorLabel(n)}</span>{" "}
          {n.kind === "friend_request" && "wants to be friends"}
          {n.kind === "goal_invite" && "invited you to join their Goal"}
          {n.kind === "goal_complete" &&
            (n.streak && n.streak >= 7
              ? `hit a ${n.streak}-day streak on "${n.activityName ?? "a habit"}"`
              : `completed "${n.activityName ?? "a habit"}"`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>

        {n.kind === "friend_request" && n.actionStatus === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={responding === rawId}
              onClick={() => onAcceptFriend(rawId)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={responding === rawId}
              onClick={() => onDeclineFriend(rawId)}
            >
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              Decline
            </Button>
          </div>
        )}

        {n.kind === "goal_invite" && n.actionStatus === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={responding === rawId}
              onClick={() => onAcceptGoal(n)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={responding === rawId}
              onClick={() => onDeclineGoal(n)}
            >
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              Decline
            </Button>
          </div>
        )}

        {n.kind === "goal_complete" && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => {
              onClose();
              navigate("/");
            }}
          >
            View on For Today
          </button>
        )}
      </div>
    </div>
  );
}

interface NotificationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsDrawer({ open, onOpenChange }: NotificationsDrawerProps) {
  const navigate = useNavigate();
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const { notifications, loading, error, reload } = useNotifications();
  const { acceptGoalInvite, declineGoalInvite } = useGoals();
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

  const handleAcceptGoal = async (n: InboxNotification) => {
    if (!n.goalId) return;
    const rawId = n.id.startsWith("gi-") ? n.id.slice(3) : n.id;
    setResponding(rawId);
    await acceptGoalInvite({ goalId: n.goalId });
    await reload();
    setResponding(null);
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
          <div className="max-h-[70svh] overflow-y-auto">
            {!isSupabaseConfigured || !isAuthed ? (
              <div className="space-y-3 p-4">
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
              <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="py-10 text-center text-sm text-destructive">{error}</p>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
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
                    onAcceptGoal={(item) => void handleAcceptGoal(item)}
                    onDeclineGoal={(item) => void handleDeclineGoal(item)}
                    onClose={() => onOpenChange(false)}
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
    </>
  );
}
