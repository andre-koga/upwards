import { CheckCircle2, Flame, Users, X, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ActivityCompletionDetails } from "@/components/notifications/activity-completion-details";
import type { InboxNotification } from "@/lib/notifications/use-notifications";
import { isNotificationClearable } from "@/lib/notifications/notification-dismissals";
import { cn } from "@/lib/utils";
import { getActiveDateFnsLocale } from "@/lib/i18n";
import type { TFunction } from "i18next";

function actorDisplayLabel(n: InboxNotification, t: TFunction<"notifications">): string {
  const name = n.actorDisplayName?.trim() || n.actorUsername?.trim();
  return name || t("someone");
}

function notificationMessage(n: InboxNotification, t: TFunction<"notifications">): string {
  const name = actorDisplayLabel(n, t);
  if (n.kind === "friend_request") {
    return t("friendRequest", { name });
  }
  if (n.kind === "daily_summary") {
    return t("dailySummary", { name });
  }
  const habit = n.activityName?.trim() || t("aHabit");
  const streak = n.streak ?? 0;
  const unit = n.routine === "never" ? t("daysWithoutSlip") : t("dayStreak");
  return t("activityComplete", { name, habit, streak, unit });
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
  onOpenRecap,
  onCloseDrawer,
  responding,
}: {
  n: InboxNotification;
  onAcceptFriend: (id: string) => void;
  onDeclineFriend: (id: string) => void;
  onDismiss?: (id: string) => void;
  onOpenRecap?: (n: InboxNotification) => void;
  onCloseDrawer?: () => void;
  responding: string | null;
}) {
  const { t } = useTranslation("notifications");
  const rawId = rawActionId(n);
  const canDismiss = isNotificationClearable(n);
  const isClickableRow = n.kind === "daily_summary";

  const handleRowClick = () => {
    if (!isClickableRow) return;
    onOpenRecap?.(n);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3",
        isClickableRow && "cursor-pointer transition-colors hover:bg-muted/50"
      )}
      onClick={isClickableRow ? handleRowClick : undefined}
    >
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
        {n.kind === "daily_summary" && (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{notificationMessage(n, t)}</p>
        {n.kind === "activity_complete" && <ActivityCompletionDetails n={n} />}
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(n.createdAt), {
            addSuffix: true,
            locale: getActiveDateFnsLocale(),
          })}
        </p>

        {n.kind === "friend_request" && n.actionStatus === "pending" && (
          <div
            className="flex gap-2 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              disabled={responding === rawId}
              onClick={() => { onCloseDrawer?.(); onAcceptFriend(rawId); }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {t("accept")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={responding === rawId}
              onClick={() => { onCloseDrawer?.(); onDeclineFriend(rawId); }}
            >
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              {t("decline")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex h-7 w-7 shrink-0 items-start justify-center">
        {canDismiss && onDismiss && !isClickableRow ? (
          <Button
            type="button"
            variant="ghost"
            size="smIcon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
            aria-label={t("dismissAria")}
            title={t("dismiss")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
