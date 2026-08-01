import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/notifications/use-notifications";
import { matchesFriendRequestNotification } from "@/lib/notifications/notification-inbox-utils";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import { NotificationRow } from "@/components/notifications/notification-row";
import { SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsDrawer({
  open,
  onClose,
}: NotificationsDrawerProps) {
  const { t } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const {
    notifications,
    loading,
    error,
    reload,
    clearableCount,
    dismissNotification,
    dismissAllClearable,
    removeNotificationsMatching,
  } = useNotifications();
  const { respond: respondFriend } = useFriends();
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (open) void reload({ silent: true });
  }, [open, reload]);

  const handleAcceptFriend = async (id: string) => {
    setResponding(id);
    removeNotificationsMatching((n) => matchesFriendRequestNotification(n, id));
    try {
      await respondFriend(id, true);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  const handleDeclineFriend = async (id: string) => {
    setResponding(id);
    removeNotificationsMatching((n) => matchesFriendRequestNotification(n, id));
    try {
      await respondFriend(id, false);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  return (
    <SheetContent
      side="top"
      showCloseButton={false}
      className="gap-0 rounded-b-2xl border-b border-border p-0 pt-2 shadow-xl"
    >
      {isSupabaseConfigured && isAuthed ? (
        <SheetHeader className="flex h-11 flex-row items-center justify-between gap-3 border-b border-border px-4 py-0">
          <SheetTitle className="text-sm leading-none">
            {t("notificationsDrawer.title")}
          </SheetTitle>
          {clearableCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 px-2 text-xs text-muted-foreground"
              onClick={dismissAllClearable}
            >
              {t("notificationsDrawer.clearAll")}
            </Button>
          )}
        </SheetHeader>
      ) : (
        <SheetTitle className="sr-only">
          {t("notificationsDrawer.title")}
        </SheetTitle>
      )}

      <div className="flex max-h-[70svh] flex-col overflow-y-auto">
        {!isSupabaseConfigured || !isAuthed ? (
          <div className="flex flex-1 flex-col justify-center space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              {t("notificationsDrawer.signInRequired")}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClose();
                navigate("/settings");
              }}
            >
              {t("notificationsDrawer.goToSettings")}
            </Button>
          </div>
        ) : loading && notifications.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
            {tCommon("loading")}
          </p>
        ) : error ? (
          <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-destructive">
            {error}
          </p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-2 text-center">
            <Bell className="m-2 h-6 w-6 text-muted-foreground/30" />
            <p className="text-sm font-medium">
              {t("notificationsDrawer.empty")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("notificationsDrawer.emptyHelper")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onAcceptFriend={(id) => void handleAcceptFriend(id)}
                onDeclineFriend={(id) => void handleDeclineFriend(id)}
                onDismiss={dismissNotification}
                onCloseDrawer={onClose}
                responding={responding}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center py-2">
        <div className="h-1 w-10 rounded-full bg-muted" />
      </div>
    </SheetContent>
  );
}
