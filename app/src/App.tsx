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
import { SetupPrompt } from "@/components/onboarding/setup-prompt";
import { OldDayEditDialog } from "@/components/journal/old-day-edit-dialog";
import { AccountSwitchDialog } from "@/components/settings/account-switch-dialog";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { useAuthGate } from "@/lib/use-auth-gate";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { UpdateRequiredDialog } from "@/components/pwa/update-required-dialog";
import { isYouMode } from "@/lib/app-mode";
import { useIsGuest } from "@/lib/guest";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

const SettingsPage = lazy(() => import("@/pages/settings"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const SyncIssuesPage = lazy(() => import("@/pages/sync-issues"));
const WhatsNewPage = lazy(() => import("@/pages/whats-new"));
const YouWordsPage = lazy(() => import("@/pages/you-words"));
const YouTypesPage = lazy(() => import("@/pages/you-types"));
const JournalPage = lazy(() => import("@/pages/journal"));
const LogsPage = lazy(() => import("@/pages/logs"));
const YouPage = lazy(() => import("@/pages/you"));

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

// The portrait site works without an account. Its sign-in screen is a page of
// its own that a guest chooses to open; everywhere else it is the gate.
const GUEST_SIGN_IN_ROUTE = "/sign-in";

function AppFrame() {
  const location = useLocation();
  const gate = useAuthGate();
  const guest = useIsGuest();
  const showSignIn =
    gate === "signed_out" &&
    !PUBLIC_ROUTES.has(location.pathname) &&
    (!isYouMode || location.pathname === GUEST_SIGN_IN_ROUTE);
  const showLoading =
    gate === "loading" && !PUBLIC_ROUTES.has(location.pathname);

  const showNavigation =
    !showSignIn && !showLoading && !routeHidesNavigation(location.pathname);

  return (
    <AppShell
      navigation={showNavigation}
      chrome={showSignIn || showLoading || guest ? null : <SyncStatus />}
    >
      {showSignIn ? (
        <SignInScreen />
      ) : showLoading ? (
        <PageLoadingFallback />
      ) : (
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {isYouMode ? (
              <Route path="/" element={<Navigate to="/you" replace />} />
            ) : (
              <Route path="/" element={<TodayPage />} />
            )}
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
            {!isYouMode && (
              <>
                <Route path="/journal" element={<JournalPage />} />
                {/* Memories joined the journal as one record (B3); old links land there. */}
                <Route
                  path="/memories"
                  element={<Navigate to="/journal" replace />}
                />
              </>
            )}
            <Route path="/logs" element={<LogsPage />} />
            {/* The weekly summary lived here. Old links open You. */}
            <Route path="/home" element={<Navigate to="/you" replace />} />
            <Route path="/you" element={<YouPage />} />
            <Route path="/you/types" element={<YouTypesPage />} />
            {!isYouMode && (
              <Route path="/you/words" element={<YouWordsPage />} />
            )}
            {/* The portrait site has no other pages; anything else opens You. */}
            {isYouMode && (
              <Route path="*" element={<Navigate to="/you" replace />} />
            )}
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
      {/* Its answers are saved to the account, so the portrait site must not
          ask: a "not now" here would stop the full app from ever asking. */}
      {isYouMode ? null : <SetupPrompt />}
      <InstallAppPrompt />
      <UpdateRequiredDialog />
      {isYouMode ? null : <OldDayEditDialog />}
      <SpeedInsights />
      <Analytics />
    </BrowserRouter>
  );
}
