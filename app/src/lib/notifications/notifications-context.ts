import { createContext } from "react";
import type { NotificationsContextValue } from "@/lib/notifications/notification-inbox-types";

export const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);
