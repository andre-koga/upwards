import { CheckCircle2, Flame, PartyPopper, Target, Users, X, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { GoalNotificationDetails } from "@/components/promises/goal-notification-details";
import type { InboxNotification } from "@/lib/promises/use-notifications";
import { isNotificationClearable } from "@/lib/promises/notification-dismissals";
import {
  actorDisplayLabel,
  formatGoalAchievedMessage,
  formatGoalCompleteMessage,
  formatGoalShareMessage,
} from "@/lib/promises/notification-labels";
import { cn } from "@/lib/utils";

function notificationMessage(n: InboxNotification): string {
  if (n.kind === "friend_request") {
    return `${actorDisplayLabel(n)} wants to be friends`;
  }
  if (n.kind === "goal_share") {
    return formatGoalShareMessage(n);
  }
  if (n.kind === "goal_achieved") {
    return formatGoalAchievedMessage(n);
  }
  if (n.kind === "goal_complete") {
    return formatGoalCompleteMessage(n);
  }
  return "";
}

function rawActionId(n: InboxNotification): string {
  if (n.id.startsWith("fr-") || n.id.startsWith("gs-")) {
    return n.id.slice(3);
  }
  return n.id;
}

export function NotificationRow({
  n,
  onAcceptFriend,
  onDeclineFriend,
  onAcceptGoalShare,
  onDeclineGoalShare,
  onStopWatchingGoalShare,
  onDismiss,
  responding,
}: {
  n: InboxNotification;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onAcceptGoalShare: (notification: InboxNotification) => void;
  onDeclineGoalShare: (notification: InboxNotification) => void;
  onStopWatchingGoalShare?: (shareId: string) => void;
  onDismiss?: (id: string) => void;
  responding: string | null;
}) {
  const rawId = rawActionId(n);
  const canDismiss = isNotificationClearable(n);
  const isCelebration = n.kind === "goal_achieved";
  const canStopWatching =
    Boolean(n.shareId) &&
    (n.kind === "goal_complete" || n.kind === "goal_achieved") &&
    onStopWatchingGoalShare;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3",
        isCelebration && "bg-green-50/70 dark:bg-green-950/20"
      )}
    >
      <span className="mt-0.5 shrink-0">
        {n.kind === "friend_request" && (
          <Users className="h-4 w-4 text-blue-500" />
        )}
        {n.kind === "goal_share" && (
          <Target className="h-4 w-4 text-primary" />
        )}
        {n.kind === "goal_achieved" && (
          <PartyPopper className="h-4 w-4 text-amber-500" />
        )}
        {n.kind === "goal_complete" && n.streak && n.streak >= 7 ? (
          <Flame className="h-4 w-4 text-orange-500" />
        ) : n.kind === "goal_complete" ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : null}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        {isCelebration && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Goal reached
          </p>
        )}
        <p
          className={cn(
            "text-sm leading-snug",
            isCelebration && "font-medium text-green-800 dark:text-green-300"
          )}
        >
          {notificationMessage(n)}
        </p>

        <GoalNotificationDetails n={n} />

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

        {n.kind === "goal_share" && n.actionStatus === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={responding === rawId}
              onClick={() => onAcceptGoalShare(n)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={responding === rawId}
              onClick={() => onDeclineGoalShare(n)}
            >
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              Decline
            </Button>
          </div>
        )}

        {canStopWatching && n.shareId && (
          <div className="pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={responding === n.shareId}
              onClick={() => onStopWatchingGoalShare(n.shareId!)}
            >
              Stop watching this goal
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
