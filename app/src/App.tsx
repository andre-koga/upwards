import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import TodayPage from "@/pages/today";
import SyncStatus from "@/components/settings/sync-status";
import { AuthDataHandoffDialog } from "@/components/settings/auth-data-handoff-dialog";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

const SettingsPage = lazy(() => import("@/pages/settings"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const TaskOrderPage = lazy(() => import("@/pages/task-order"));
const SyncIssuesPage = lazy(() => import("@/pages/sync-issues"));
const WhatsNewPage = lazy(() => import("@/pages/whats-new"));
const JournalPage = lazy(() => import("@/pages/journal"));
const MemoriesPage = lazy(() => import("@/pages/memories"));
const LogsPage = lazy(() => import("@/pages/logs"));
const RedesignPreviewPage = lazy(() => import("@/pages/redesign-preview"));
const RedesignPreviewBPage = lazy(() => import("@/pages/redesign-preview-b"));
const RedesignPreviewCPage = lazy(() => import("@/pages/redesign-preview-c"));
const RedesignPreviewDPage = lazy(() => import("@/pages/redesign-preview-d"));
const HomePage = lazy(() => import("@/pages/home"));

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

// Pages that ship their own full-width, adaptive desktop layout — these
// intentionally render outside the shared phone-frame shell instead of being
// squeezed into its 430px card. See docs/architecture/ui-system-and-responsive-layout.md:
// this app-wide phone-frame simulation is the *current* baseline, not the
// desktop direction, so an already-adaptive preview page shouldn't inherit it.
const FULL_BLEED_ROUTES = new Set([
  "/redesign-preview",
  "/redesign-preview-b",
  "/redesign-preview-c",
  "/redesign-preview-d",
]);

function AppShell() {
  const location = useLocation();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  if (FULL_BLEED_ROUTES.has(location.pathname)) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/redesign-preview" element={<RedesignPreviewPage />} />
          <Route
            path="/redesign-preview-b"
            element={<RedesignPreviewBPage />}
          />
          <Route
            path="/redesign-preview-c"
            element={<RedesignPreviewCPage />}
          />
          <Route
            path="/redesign-preview-d"
            element={<RedesignPreviewDPage />}
          />
        </Routes>
      </Suspense>
    );
  }

  return (
    <>
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
      <div className="min-h-dvh md:flex md:h-screen md:items-stretch md:justify-center md:gap-10 md:px-6 md:py-6">
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
                <Route path="/memories" element={<MemoriesPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/home" element={<HomePage />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
      <AuthDataHandoffDialog />
      <InstallAppPrompt />
      <SpeedInsights />
      <Analytics />
    </BrowserRouter>
  );
}
