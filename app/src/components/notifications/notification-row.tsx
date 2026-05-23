import { CheckCircle2, Flame, Users, X, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ActivityCompletionDetails } from "@/components/notifications/activity-completion-details";
import type { InboxNotification } from "@/lib/notifications/use-notifications";
import { isNotificationClearable } from "@/lib/notifications/notification-dismissals";
import { cn } from "@/lib/utils";

function actorDisplayLabel(n: InboxNotification): string {
  const name = n.actorDisplayName?.trim() || n.actorUsername?.trim();
  return name || "Someone";
}

function notificationMessage(n: InboxNotification): string {
  if (n.kind === "friend_request") {
    return `${actorDisplayLabel(n)} wants to be friends`;
  }
  const habit = n.activityName?.trim() || "a habit";
  const streak = n.streak ?? 0;
  const unit = n.routine === "never" ? "days without slip" : "day streak";
  return `${actorDisplayLabel(n)} completed ${habit} · ${streak} ${unit}`;
}

function rawActionId(n: InboxNotification): string {
  if (n.id.startsWith("fr-")) return n.id.slice(3);
  return n.id;
}

export function NotificationRow({
  n,
  onAcceptFriend,
  onDeclineFriend,
  onDismiss,
  responding,
}: {
  n: InboxNotification;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
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
        {n.kind === "activity_complete" &&
          (n.streak && n.streak >= 7 ? (
            <Flame className="h-4 w-4 text-orange-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ))}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{notificationMessage(n)}</p>
        <ActivityCompletionDetails n={n} />
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
      </div>

      <div className="flex h-7 w-7 shrink-0 items-start justify-center">
        {canDismiss && onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="smIcon"
            className={cn(
              "h-7 w-7 text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onDismiss(n.id)}
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
