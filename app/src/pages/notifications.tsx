import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle2, XCircle, Flame, Users, Target } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/promises/use-notifications";
import { useGoals } from "@/lib/promises/use-goals";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import type { InboxNotification } from "@/lib/promises/use-notifications";
import {
  actorDisplayLabel,
  formatGoalCompleteMessage,
  formatGoalInviteMessage,
} from "@/lib/promises/notification-labels";
import { GoalInviteAcceptDialog } from "@/components/promises/goal-invite-accept-dialog";

function notificationMessage(n: InboxNotification): string {
  if (n.kind === "friend_request") {
    return `${actorDisplayLabel(n)} wants to be friends`;
  }
  if (n.kind === "goal_invite") {
    return formatGoalInviteMessage(n);
  }
  if (n.kind === "goal_complete") {
    return formatGoalCompleteMessage(n);
  }
  return "";
}

function NotificationRow({
  n,
  onAcceptFriend,
  onDeclineFriend,
  onAcceptGoal,
  onDeclineGoal,
  responding,
}: {
  n: InboxNotification;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onAcceptGoal: (notification: InboxNotification) => void;
  onDeclineGoal: (n: InboxNotification) => void;
  responding: string | null;
}) {
  const rawId = n.id.startsWith("fr-")
    ? n.id.slice(3)
    : n.id.startsWith("gi-")
      ? n.id.slice(3)
      : n.id;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {/* Icon */}
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

      {/* Body */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{notificationMessage(n)}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>

        {/* Actionable */}
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

      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const { notifications, loading, error, reload } = useNotifications();
  const { declineGoalInvite } = useGoals();
  const { respond: respondFriend } = useFriends();
  const [responding, setResponding] = useState<string | null>(null);
  const [goalInviteAccept, setGoalInviteAccept] = useState<InboxNotification | null>(
    null
  );

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
    <div className="space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 shrink-0" />
          Notifications
        </h1>
        <p className="text-sm text-muted-foreground">
          Friend requests, Goal invites, and partner progress.
        </p>
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
            Friend requests, Goal invites, and partner completions will show up here.
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
              onAcceptGoal={handleAcceptGoal}
              onDeclineGoal={(item) => void handleDeclineGoal(item)}
              responding={responding}
            />
          ))}
        </div>
      )}

      <FloatingBackButton to="/" title="Home" />

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
    </div>
  );
}
