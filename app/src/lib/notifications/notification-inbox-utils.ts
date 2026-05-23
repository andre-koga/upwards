import type { InboxNotification } from "@/lib/notifications/use-notifications";

export function matchesFriendRequestNotification(
  notification: InboxNotification,
  requestId: string
): boolean {
  return notification.id === `fr-${requestId}` || notification.id === requestId;
}
