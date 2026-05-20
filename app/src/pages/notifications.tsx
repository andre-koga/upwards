import { useNavigate } from "react-router-dom";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { SettingsSection } from "@/components/ui/settings-section";
import { Button } from "@/components/ui/button";
import { Bell, HandshakeIcon, Flame, Heart } from "lucide-react";
import { usePromiseNotifications } from "@/lib/promises/use-promise-notifications";
import { useAuth } from "@/lib/use-auth";
import { formatDistanceToNow } from "date-fns";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const { notifications, loading } = usePromiseNotifications();

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 shrink-0" />
          Notifications
        </h1>
        <p className="text-sm text-muted-foreground">
          Progress from promises you're part of — nothing else.
        </p>
      </header>

      {!isSupabaseConfigured || !isAuthed ? (
        <SettingsSection title="Sign in required">
          <p className="text-sm text-muted-foreground">
            Notifications require a sync account. Sign in from Settings.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/settings")}
          >
            Go to Settings
          </Button>
        </SettingsSection>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You'll see progress from your promise partners here.
          </p>
        </div>
      ) : (
        <div className="space-y-1 overflow-hidden rounded-xl border border-border">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              onClick={() => navigate(`/promises/${n.promiseId}`)}
            >
              <span className="mt-0.5 shrink-0">
                {n.kind === "reaction" ? (
                  <Heart className="h-4 w-4 text-pink-500" />
                ) : n.progressEvent?.kind === "streak_milestone" ? (
                  <Flame className="h-4 w-4 text-orange-500" />
                ) : (
                  <HandshakeIcon className="h-4 w-4 text-primary" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-medium">
                    {n.fromDisplayName ?? "Your partner"}
                  </span>{" "}
                  {n.kind === "reaction"
                    ? n.reactionKind === "congratulate"
                      ? "congratulated you"
                      : "sent you motivation"
                    : n.progressEvent?.kind === "streak_milestone"
                      ? `hit a ${n.progressEvent.payload.streak}-day streak on "${n.progressEvent.payload.activityName}"`
                      : `completed "${n.progressEvent?.payload.activityName ?? n.promiseTitle}"`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.promiseTitle} ·{" "}
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
