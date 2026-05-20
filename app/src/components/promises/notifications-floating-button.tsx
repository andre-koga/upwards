import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { useNotifications } from "@/lib/promises/use-notifications";
import { NotificationsDrawer } from "./notifications-drawer";
import { cn } from "@/lib/utils";

export function NotificationsFloatingButton() {
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
      <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-end px-3">
        <div className="pointer-events-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full border-border bg-background p-0 shadow-md"
            )}
            onClick={() => navigate("/settings")}
            title="Sign in"
            aria-label="Sign in"
          >
            <LogIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const label = hasUnread
    ? `Notifications (${unreadCount} unread)`
    : "Notifications";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-end px-3">
        <div className="pointer-events-auto relative">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-full border-border bg-background p-0 shadow-md"
            )}
            onClick={() => setDrawerOpen(true)}
            title={label}
            aria-label={label}
          >
            <Bell className="h-4 w-4" />
          </Button>
          {hasUnread && (
            <span
              className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-background"
              aria-hidden
            />
          )}
        </div>
      </div>

      <NotificationsDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
