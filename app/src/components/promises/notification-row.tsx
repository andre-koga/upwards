import { CheckCircle2, Flame, Target, Users, X, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import type { InboxNotification } from "@/lib/promises/use-notifications";
import { isNotificationClearable } from "@/lib/promises/notification-dismissals";
import {
  actorDisplayLabel,
  formatGoalCompleteMessage,
  formatGoalInviteMessage,
} from "@/lib/promises/notification-labels";

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

function rawActionId(n: InboxNotification): string {
  if (n.id.startsWith("fr-") || n.id.startsWith("gi-")) {
    return n.id.slice(3);
  }
  return n.id;
}

export function NotificationRow({
  n,
  onAcceptFriend,
  onDeclineFriend,
  onAcceptGoal,
  onDeclineGoal,
  onDismiss,
  responding,
}: {
  n: InboxNotification;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onAcceptGoal: (notification: InboxNotification) => void;
  onDeclineGoal: (n: InboxNotification) => void;
  onDismiss?: (id: string) => void;
  responding: string | null;
}) {
  const rawId = rawActionId(n);
  const canDismiss = isNotificationClearable(n);

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
        <p className="text-sm leading-snug">{notificationMessage(n)}</p>
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
      </div>

      {canDismiss && onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="smIcon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onDismiss(n.id)}
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
