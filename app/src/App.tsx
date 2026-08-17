import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import TodayPage from "@/pages/today";
import SyncStatus from "@/components/settings/sync-status";
import { AuthDataHandoffDialog } from "@/components/settings/auth-data-handoff-dialog";
import { BrowserChromeThemeSync } from "@/components/layout/browser-chrome-theme-sync";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

const SettingsPage = lazy(() => import("@/pages/settings"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const TaskOrderPage = lazy(() => import("@/pages/task-order"));
const SyncIssuesPage = lazy(() => import("@/pages/sync-issues"));
const WhatsNewPage = lazy(() => import("@/pages/whats-new"));
const JournalPage = lazy(() => import("@/pages/journal"));
const LogsPage = lazy(() => import("@/pages/logs"));

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
          <SyncStatus />
          <div data-app-scroll className="md:h-full md:overflow-y-auto">
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/" element={<TodayPage />} />
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
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/logs" element={<LogsPage />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      <AuthDataHandoffDialog />
      <SpeedInsights />
      <Analytics />
    </BrowserRouter>
  );
}
