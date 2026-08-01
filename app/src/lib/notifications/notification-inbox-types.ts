export type NotificationKind = "friend_request" | "activity_complete";

export interface InboxNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  activityName: string | null;
  actionStatus: "pending" | "accepted" | "declined" | null;
  createdAt: string;
  streak?: number;
  routine?: string | null;
}

export type LoadNotificationsOptions = {
  silent?: boolean;
};

export interface NotificationsContextValue {
  notifications: InboxNotification[];
  loading: boolean;
  error: string | null;
  reload: (options?: LoadNotificationsOptions) => Promise<void>;
  unreadCount: number;
  clearableCount: number;
  dismissNotification: (id: string) => void;
  dismissAllClearable: () => void;
  removeNotificationsMatching: (
    match: (notification: InboxNotification) => boolean
  ) => void;
  dismissNotificationIds: (ids: string[]) => void;
}
