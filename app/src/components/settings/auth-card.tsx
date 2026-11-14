import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LogIn, LogOut, RefreshCw } from "lucide-react";

import { ConfirmFormDialog } from "@/components/forms";
import {
  SettingsActionRow,
  SettingsBlock,
  SettingsGroup,
  SettingsValueRow,
} from "@/components/settings/settings-list";
import { SignOutConfirmDialog } from "@/components/settings/sign-out-confirm-dialog";
import { useIsGuest } from "@/lib/guest";
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
  if (result.post && !result.post.ok) {
    return t("auth.recovery.result.post", { detail: result.post.detail });
  }
  if (!result.refresh) return t("auth.recovery.result.reached");
  if (result.refresh.ok) return t("auth.recovery.result.ok");
  return t(`auth.recovery.result.refresh.${result.refresh.reason}`, {
    detail: result.refresh.detail,
  });
}

export function AuthCard() {
  const { t } = useTranslation("settings");
  const guest = useIsGuest();
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

  if (guest) {
    return (
      <SettingsGroup title={t("auth.title")}>
        <SettingsBlock>
          <p className="text-sm text-muted-foreground">
            {t("auth.guest.note")}
          </p>
        </SettingsBlock>
        <SettingsActionRow
          icon={LogIn}
          label={t("auth.guest.action")}
          to="/sign-in"
        />
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup title={t("auth.title")}>
      {isAuthed ? (
        <>
          <SettingsValueRow
            label={t("auth.signedInAs")}
            value={
              <span className="text-foreground">
                {currentUserEmail ?? t("auth.unknownEmail")}
              </span>
            }
          />
          <SettingsActionRow
            icon={LogOut}
            label={t("auth.signOut")}
            tone="destructive"
            disabled={signOutBusy}
            onClick={() => void handleSignOut()}
          />
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
        // session at all.
        <>
          <SettingsBlock>
            <p className="text-sm text-muted-foreground">
              {isSupabaseConfigured
                ? t("auth.sessionPending")
                : t("auth.syncNotConfigured")}
            </p>
            {checkResult ? (
              <p
                className="text-xs tabular-nums text-muted-foreground"
                role="status"
              >
                {describeCheck(checkResult, t)}
              </p>
            ) : null}
          </SettingsBlock>
          {isSupabaseConfigured ? (
            <>
              <SettingsActionRow
                icon={RefreshCw}
                label={
                  checking
                    ? t("auth.recovery.checking")
                    : t("auth.recovery.check")
                }
                disabled={checking}
                onClick={() => void handleCheckConnection()}
              />
              <SettingsActionRow
                icon={LogIn}
                label={t("auth.recovery.signInAgain")}
                onClick={() => setSignInAgainOpen(true)}
              />
              <ConfirmFormDialog
                open={signInAgainOpen}
                onOpenChange={setSignInAgainOpen}
                title={t("auth.recovery.confirmTitle")}
                message={t("auth.recovery.confirmMessage")}
                confirmLabel={t("auth.recovery.confirm")}
                cancelLabel={t("auth.recovery.cancel")}
                onConfirm={() => {
                  setSignInAgainOpen(false);
                  forgetSessionKeepData();
                }}
              />
            </>
          ) : null}
        </>
      )}
    </SettingsGroup>
  );
}
