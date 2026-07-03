import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNotifications,
  matchesFriendRequestNotification,
  type InboxNotification,
} from "@/lib/notifications/use-notifications";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import { NotificationRow } from "@/components/notifications/notification-row";
import { FriendRecapDialog } from "@/components/notifications/friend-recap-dialog";

interface NotificationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsDrawer({
  open,
  onOpenChange,
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
  // Kept alive outside the sliding panel so closing the drawer doesn't unmount it.
  const [activeRecap, setActiveRecap] = useState<InboxNotification | null>(null);

  useEffect(() => {
    if (open) void reload({ silent: true });
  }, [open, reload]);

  const handleAcceptFriend = async (id: string) => {
    setResponding(id);
    removeNotificationsMatching((n) =>
      matchesFriendRequestNotification(n, id)
    );
    try {
      await respondFriend(id, true);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  const handleDeclineFriend = async (id: string) => {
    setResponding(id);
    removeNotificationsMatching((n) =>
      matchesFriendRequestNotification(n, id)
    );
    try {
      await respondFriend(id, false);
      await reload({ silent: true });
    } finally {
      setResponding(null);
    }
  };

  const handleOpenRecap = (n: InboxNotification) => {
    dismissNotification(n.id);
    onOpenChange(false);
    setActiveRecap(n);
  };

  return (
    <>
      {/* Recap dialog lives outside the drawer panel so it survives the panel closing */}
      {activeRecap && (
        <FriendRecapDialog
          open={activeRecap !== null}
          onOpenChange={(next) => { if (!next) setActiveRecap(null); }}
          n={activeRecap}
        />
      )}

      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[60] transition-all duration-300",
          open
            ? "pointer-events-auto bg-black/50 backdrop-blur-sm"
            : "bg-transparent backdrop-blur-0"
        )}
        onClick={() => onOpenChange(false)}
      />

      <div
        className={cn(
          "fixed inset-x-0 top-0 z-[70] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="rounded-b-2xl border-b border-border bg-background shadow-xl pt-2">
          {isSupabaseConfigured && isAuthed && (
            <div className="flex h-11 items-center justify-between gap-3 border-b border-border px-4">
              <span className="text-sm font-semibold leading-none">
                {t("notificationsDrawer.title")}
              </span>
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
            </div>
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
                    onOpenChange(false);
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
                <p className="text-sm font-medium">{t("notificationsDrawer.empty")}</p>
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
                    onOpenRecap={handleOpenRecap}
                    onCloseDrawer={() => onOpenChange(false)}
                    responding={responding}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </>
  );
}
