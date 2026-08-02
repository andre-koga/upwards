import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { useNotifications } from "@/lib/notifications/use-notifications";
import { NotificationsDrawer } from "@/components/notifications/notifications-drawer";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";

export function NotificationsFloatingButton() {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const { unreadCount } = useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasUnread = unreadCount > 0;

  if (pathname !== "/") {
    return null;
  }

  if (!isAuthed) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-end px-3 md:left-52">
        <div className="pointer-events-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full border-border bg-background p-0 shadow-md"
            onClick={() => navigate("/settings")}
            title={t("signIn")}
            aria-label={t("signIn")}
          >
            <LogIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const label = hasUnread
    ? t("notificationsUnread", { count: unreadCount })
    : t("notifications");

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-end px-3 md:left-52">
        <div className="pointer-events-auto relative">
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-full border-border bg-background p-0 shadow-md"
              title={label}
              aria-label={label}
            >
              <Bell className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          {hasUnread && (
            <span
              className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-background"
              aria-hidden
            />
          )}
        </div>
      </div>

      <NotificationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Sheet>
  );
}
