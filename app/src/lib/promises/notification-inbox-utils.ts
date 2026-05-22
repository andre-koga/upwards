import type { InboxNotification } from "@/lib/promises/use-notifications";
import { isNotificationClearable } from "@/lib/promises/notification-dismissals";

export function matchesGoalShareNotification(
  notification: InboxNotification,
  shareId: string
): boolean {
  return (
    notification.id === `gs-${shareId}` || notification.shareId === shareId
  );
}

export function matchesFriendRequestNotification(
  notification: InboxNotification,
  requestId: string
): boolean {
  return notification.id === `fr-${requestId}` || notification.id === requestId;
}

export function clearableNotificationIdsForShare(
  notifications: InboxNotification[],
  shareId: string
): string[] {
  return notifications
    .filter(
      (n) => n.shareId === shareId && isNotificationClearable(n)
    )
    .map((n) => n.id);
}
