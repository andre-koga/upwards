import { Link, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePromiseNotifications } from "@/lib/promises/use-promise-notifications";
import { cn } from "@/lib/utils";

export function NotificationsFloatingButton() {
  const { pathname } = useLocation();
  const { unreadCount } = usePromiseNotifications();
  const hasUnread = unreadCount > 0;

  if (pathname === "/notifications") {
    return null;
  }

  const label = hasUnread
    ? `Notifications (${unreadCount} unread)`
    : "Notifications";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-end px-3">
      <div className="pointer-events-auto relative">
        <Button
          asChild
          type="button"
          variant="outline"
          size="floatingNav"
          className={cn("border-border bg-background shadow-lg")}
        >
          <Link to="/notifications" title={label} aria-label={label}>
            <Bell className="h-5 w-5" />
          </Link>
        </Button>
        {hasUnread && (
          <span
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
