import { useContext } from "react";
import { NotificationsContext } from "@/lib/notifications/notifications-context";
import type { NotificationsContextValue } from "@/lib/notifications/notification-inbox-types";

export type {
  InboxNotification,
  LoadNotificationsOptions,
  NotificationKind,
  NotificationsContextValue,
} from "@/lib/notifications/notification-inbox-types";

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider"
    );
  }
  return ctx;
}
