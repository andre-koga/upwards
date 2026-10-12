import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LogOut, RefreshCw } from "lucide-react";

import { ConfirmFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { SignOutConfirmDialog } from "@/components/settings/sign-out-confirm-dialog";
import { isSignOutBlockedError, useAuth } from "@/lib/use-auth";
import { syncEngine } from "@/lib/sync";
import {
  forgetSessionKeepData,
  retrySessionNow,
  type SessionCheckResult,
} from "@/lib/auth-recovery";

function describeCheck(
  result: SessionCheckResult,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!result.reach.ok) {
    return t(`auth.recovery.result.reach.${result.reach.reason}`, {
      detail: result.reach.detail,
    });
  }
  if (!result.refresh) return t("auth.recovery.result.reached");
  if (result.refresh.ok) return t("auth.recovery.result.ok");
  return t(`auth.recovery.result.refresh.${result.refresh.reason}`, {
    detail: result.refresh.detail,
  });
}

export function AuthCard() {
  const { t } = useTranslation("settings");
  const { isSupabaseConfigured, isAuthed, currentUserEmail, signOut } =
    useAuth();
  const [signOutBlockedOpen, setSignOutBlockedOpen] = useState(false);
  const [signOutBlockedPending, setSignOutBlockedPending] = useState(0);
  const [signOutBlockedUnsynced, setSignOutBlockedUnsynced] = useState(0);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<SessionCheckResult | null>(
    null
  );
  const [signInAgainOpen, setSignInAgainOpen] = useState(false);

  const handleCheckConnection = async () => {
    setChecking(true);
    try {
      setCheckResult(await retrySessionNow());
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutBusy(true);
    try {
      await signOut();
    } catch (error) {
      if (isSignOutBlockedError(error)) {
        setSignOutBlockedPending(error.result.pendingCount);
        setSignOutBlockedUnsynced(error.result.unsyncedRowCount);
        setSignOutBlockedOpen(true);
        return;
      }
      console.error("Sign out failed", error);
    } finally {
      setSignOutBusy(false);
    }
  };

  const handleRetrySyncBeforeSignOut = async () => {
    setSignOutBusy(true);
    try {
      await syncEngine.sync();
      await signOut();
      setSignOutBlockedOpen(false);
    } catch (error) {
      if (isSignOutBlockedError(error)) {
        setSignOutBlockedPending(error.result.pendingCount);
        setSignOutBlockedUnsynced(error.result.unsyncedRowCount);
        return;
      }
      console.error("Sign out after retry failed", error);
    } finally {
      setSignOutBusy(false);
    }
  };

  const handleDiscardAndSignOut = async () => {
    setSignOutBusy(true);
    try {
      await signOut({ forceDiscard: true });
      setSignOutBlockedOpen(false);
    } catch (error) {
      console.error("Discard and sign out failed", error);
    } finally {
      setSignOutBusy(false);
    }
  };

  return (
    <SettingsSection title={t("auth.title")}>
      {isAuthed ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t("auth.signedInAs")}{" "}
            <span className="font-medium text-foreground">
              {currentUserEmail ?? t("auth.unknownEmail")}
            </span>
          </p>
          <Button
            variant="outline"
            className="flex w-full items-center gap-2"
            disabled={signOutBusy}
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" />
            {t("auth.signOut")}
          </Button>
          <SignOutConfirmDialog
            open={signOutBlockedOpen}
            pendingOpCount={signOutBlockedPending}
            unsyncedRowCount={signOutBlockedUnsynced}
            busy={signOutBusy}
            onOpenChange={setSignOutBlockedOpen}
            onRetrySync={() => void handleRetrySyncBeforeSignOut()}
            onDiscardAndSignOut={() => void handleDiscardAndSignOut()}
          />
        </>
      ) : (
        // No Supabase: there is no account. Otherwise the person is signed in on
        // this device but the session is not confirmed yet (offline, or the app
        // is still starting): the app shows the sign-in screen when there is no
        // session at all (product-scope.md §2.6).
        <>
          <p className="text-sm text-muted-foreground">
            {isSupabaseConfigured
              ? t("auth.sessionPending")
              : t("auth.syncNotConfigured")}
          </p>
          {isSupabaseConfigured ? (
            <>
              <Button
                variant="outline"
                className="flex w-full items-center gap-2"
                disabled={checking}
                onClick={() => void handleCheckConnection()}
              >
                <RefreshCw
                  className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                  aria-hidden
                />
                {checking
                  ? t("auth.recovery.checking")
                  : t("auth.recovery.check")}
              </Button>
              {checkResult ? (
                <p
                  className="font-mono text-xs tabular-nums text-muted-foreground"
                  role="status"
                >
                  {describeCheck(checkResult, t)}
                </p>
              ) : null}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSignInAgainOpen(true)}
              >
                {t("auth.recovery.signInAgain")}
              </Button>
              <ConfirmFormDialog
                open={signInAgainOpen}
                onOpenChange={setSignInAgainOpen}
                title={t("auth.recovery.confirmTitle")}
                message={t("auth.recovery.confirmMessage")}
                confirmLabel={t("auth.recovery.confirm")}
                cancelLabel={t("auth.recovery.cancel")}
                onConfirm={() => {
                  setSignInAgainOpen(false);
                  void forgetSessionKeepData();
                }}
              />
            </>
          ) : null}
        </>
      )}
    </SettingsSection>
  );
}
