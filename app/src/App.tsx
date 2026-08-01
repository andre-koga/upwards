import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import TodayPage from "@/pages/today";
import { NotificationsFloatingButton } from "@/components/notifications/notifications-floating-button";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import SyncStatus from "@/components/settings/sync-status";
import { AuthDataHandoffDialog } from "@/components/settings/auth-data-handoff-dialog";
import { BrowserChromeThemeSync } from "@/components/layout/browser-chrome-theme-sync";
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
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  return (
    <BrowserRouter>
      <BrowserChromeThemeSync />
      {!noticeDismissed && (
        <div className="hidden md:mx-auto md:block md:max-w-sm md:pt-6">
          <button
            type="button"
            className="w-full cursor-pointer rounded-2xl border border-amber-400 bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-900 transition-opacity hover:opacity-80 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200"
            onClick={() => setNoticeDismissed(true)}
            aria-label="Dismiss mobile experience notice"
          >
            <p className="font-semibold">Mobile experience notice</p>
            <p className="mt-1">
              This app is currently built for a phone-sized viewport. Desktop
              support is still in progress. Scroll down to see the full
              experience.
            </p>
            <p className="mt-2 text-xs opacity-60">Click to dismiss</p>
          </button>
        </div>
      )}
      <div className="min-h-screen md:flex md:h-screen md:items-stretch md:justify-center md:gap-10 md:px-6 md:py-6">
        <main className="relative w-full bg-background md:h-full md:max-w-[430px] md:overflow-hidden md:rounded-2xl md:border md:border-border md:shadow-2xl md:[transform:translateZ(0)]">
          <NotificationsProvider>
            <AppSession />
            <SyncStatus />
            <NotificationsFloatingButton />
            <div data-app-scroll className="md:h-full md:overflow-y-auto">
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
                  <Route
                    path="/promises"
                    element={<Navigate to="/" replace />}
                  />
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
            </div>
          </NotificationsProvider>
        </main>
      </div>
      <AuthDataHandoffDialog />
      <SpeedInsights />
      <Analytics />
    </BrowserRouter>
  );
}
