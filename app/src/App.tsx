import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import TodayPage from "@/pages/today";
import { NotificationsFloatingButton } from "@/components/notifications/notifications-floating-button";
import { NotificationsProvider } from "@/lib/notifications/notifications-provider";
import SyncStatus from "@/components/settings/sync-status";
import { AuthDataHandoffDialog } from "@/components/settings/auth-data-handoff-dialog";
import { BrowserChromeThemeSync } from "@/components/layout/browser-chrome-theme-sync";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppOpenSession } from "@/lib/session/use-app-open-session";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

const StatsPage = lazy(() => import("@/pages/stats"));
const GroupStatsPage = lazy(() => import("@/pages/stats-group"));
const ActivityStatsPage = lazy(() => import("@/pages/stats-activity"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const TaskOrderPage = lazy(() => import("@/pages/task-order"));
const SyncIssuesPage = lazy(() => import("@/pages/sync-issues"));
const WhatsNewPage = lazy(() => import("@/pages/whats-new"));
const FriendsPage = lazy(() => import("@/pages/friends"));
const JournalPage = lazy(() => import("@/pages/journal"));
const LogsPage = lazy(() => import("@/pages/logs"));

function AppSession() {
  useAppOpenSession();
  return null;
}

function PageLoadingFallback() {
  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-label="Loading page"
    >
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BrowserChromeThemeSync />
      <AppShell>
        <TooltipProvider>
          <NotificationsProvider>
            <AppSession />
            <SyncStatus />
            <NotificationsFloatingButton />
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/" element={<TodayPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route
                  path="/stats/groups/:groupId"
                  element={<GroupStatsPage />}
                />
                <Route
                  path="/stats/groups/:groupId/activities/:activityId"
                  element={<ActivityStatsPage />}
                />
                <Route path="/promises" element={<Navigate to="/" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route
                  path="/settings/forgot-password"
                  element={<ForgotPasswordPage />}
                />
                <Route
                  path="/settings/reset-password"
                  element={<ResetPasswordPage />}
                />
                <Route
                  path="/settings/task-order"
                  element={<TaskOrderPage />}
                />
                <Route
                  path="/settings/sync-issues"
                  element={<SyncIssuesPage />}
                />
                <Route path="/whats-new" element={<WhatsNewPage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route
                  path="/notifications"
                  element={<Navigate to="/" replace />}
                />
                {/* Legacy promise routes → home */}
                <Route
                  path="/promises/:id"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/promises/join/:token"
                  element={<Navigate to="/" replace />}
                />
              </Routes>
            </Suspense>
          </NotificationsProvider>
        </TooltipProvider>
      </AppShell>
      <AuthDataHandoffDialog />
      <SpeedInsights />
      <Analytics />
    </BrowserRouter>
  );
}
