import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import TodayPage from "@/pages/today";
import SyncStatus from "@/components/settings/sync-status";
import { AppShell } from "@/components/layout/app-shell";
import { routeHidesNavigation } from "@/lib/navigation/destinations";
import { useAccountSettingsSync } from "@/lib/use-account-settings";
import { OldDayEditDialog } from "@/components/journal/old-day-edit-dialog";
import { AccountSwitchDialog } from "@/components/settings/account-switch-dialog";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { useAuthGate } from "@/lib/use-auth-gate";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { UpdateRequiredDialog } from "@/components/pwa/update-required-dialog";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

const SettingsPage = lazy(() => import("@/pages/settings"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const SyncIssuesPage = lazy(() => import("@/pages/sync-issues"));
const WhatsNewPage = lazy(() => import("@/pages/whats-new"));
const JournalPage = lazy(() => import("@/pages/journal"));
const MemoriesPage = lazy(() => import("@/pages/memories"));
const LogsPage = lazy(() => import("@/pages/logs"));
const RedesignPreviewPage = lazy(() => import("@/pages/redesign-preview"));
const RedesignPreviewBPage = lazy(() => import("@/pages/redesign-preview-b"));
const RedesignPreviewCPage = lazy(() => import("@/pages/redesign-preview-c"));
const RedesignPreviewDPage = lazy(() => import("@/pages/redesign-preview-d"));
const RedesignFlagshipPage = lazy(() => import("@/pages/redesign-flagship"));
const HomePage = lazy(() => import("@/pages/home"));
const ClipSpikePage = lazy(() => import("@/pages/clip-spike"));

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

// Reachable without an account: the links in password emails land here, and a
// signed-out visitor has to be able to ask for one.
const PUBLIC_ROUTES = new Set([
  "/settings/forgot-password",
  "/settings/reset-password",
]);

// Design previews that ship their own full-bleed layout and navigation. They
// render outside the app shell on purpose.
const FULL_BLEED_ROUTES = new Set([
  "/redesign-preview",
  "/redesign-preview-b",
  "/redesign-preview-c",
  "/redesign-preview-d",
  "/redesign-flagship",
]);

function AppFrame() {
  const location = useLocation();
  const gate = useAuthGate();
  const showSignIn =
    gate === "signed_out" && !PUBLIC_ROUTES.has(location.pathname);
  const showLoading =
    gate === "loading" && !PUBLIC_ROUTES.has(location.pathname);

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
          <Route path="/redesign-flagship" element={<RedesignFlagshipPage />} />
        </Routes>
      </Suspense>
    );
  }

  const showNavigation =
    !showSignIn && !showLoading && !routeHidesNavigation(location.pathname);

  return (
    <AppShell
      navigation={showNavigation}
      chrome={showSignIn || showLoading ? null : <SyncStatus />}
    >
      {showSignIn ? (
        <SignInScreen />
      ) : showLoading ? (
        <PageLoadingFallback />
      ) : (
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
            {/* The task-order page was removed (B2); old links land on Settings. */}
            <Route
              path="/settings/task-order"
              element={<Navigate to="/settings" replace />}
            />
            <Route path="/settings/sync-issues" element={<SyncIssuesPage />} />
            <Route path="/whats-new" element={<WhatsNewPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/memories" element={<MemoriesPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/home" element={<HomePage />} />
            {/* Developer tool for the daily-clip device spike; not linked anywhere. */}
            <Route path="/clip-spike" element={<ClipSpikePage />} />
          </Routes>
        </Suspense>
      )}
    </AppShell>
  );
}

export default function App() {
  useAccountSettingsSync();
  return (
    <BrowserRouter>
      <AppFrame />
      <AccountSwitchDialog />
      <InstallAppPrompt />
      <UpdateRequiredDialog />
      <OldDayEditDialog />
      <SpeedInsights />
      <Analytics />
    </BrowserRouter>
  );
}
