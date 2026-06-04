import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import TodayPage from "@/pages/today";
import StatsPage from "@/pages/stats";
import SettingsPage from "@/pages/settings";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import TaskOrderPage from "@/pages/task-order";
import WhatsNewPage from "@/pages/whats-new";
import FriendsPage from "@/pages/friends";
import { NotificationsFloatingButton } from "@/components/notifications/notifications-floating-button";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import SyncStatus from "@/components/settings/sync-status";
import { AuthDataHandoffDialog } from "@/components/settings/auth-data-handoff-dialog";
import { DailyRecapDialog } from "@/components/recap/daily-recap-dialog";
import { useAppOpenRecap } from "@/lib/session/use-app-open-recap";
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"

function AppWithRecap() {
  const { recapDate, loginStreak, open, dismiss } = useAppOpenRecap();

  return (
    <>
      <DailyRecapDialog
        open={open}
        recapDate={recapDate}
        loginStreak={loginStreak}
        onDismiss={dismiss}
      />
    </>
  );
}

export default function App() {
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  return (
    <BrowserRouter>
      {!noticeDismissed && (
        <div className="hidden md:mx-auto md:block md:max-w-sm md:pt-6">
          <button
            type="button"
            className="w-full cursor-pointer rounded-2xl border border-amber-400 bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-900 transition-opacity hover:opacity-80 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200"
            onClick={() => setNoticeDismissed(true)}
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
            <AppWithRecap />
            <SyncStatus />
            <NotificationsFloatingButton />
            <div data-app-scroll className="md:h-full md:overflow-y-auto">
              <Routes>
                <Route path="/" element={<TodayPage />} />
                <Route path="/stats" element={<StatsPage />} />
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
                <Route path="/settings/task-order" element={<TaskOrderPage />} />
                <Route path="/whats-new" element={<WhatsNewPage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/notifications" element={<Navigate to="/" replace />} />
                {/* Legacy promise routes → home */}
                <Route path="/promises/:id" element={<Navigate to="/" replace />} />
                <Route path="/promises/join/:token" element={<Navigate to="/" replace />} />
              </Routes>
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
