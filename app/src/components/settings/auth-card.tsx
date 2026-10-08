import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { SignOutConfirmDialog } from "@/components/settings/sign-out-confirm-dialog";
import { isSignOutBlockedError, useAuth } from "@/lib/use-auth";
import { syncEngine } from "@/lib/sync";

export function AuthCard() {
  const { t } = useTranslation("settings");
  const { isSupabaseConfigured, isAuthed, currentUserEmail, signOut } =
    useAuth();
  const [signOutBlockedOpen, setSignOutBlockedOpen] = useState(false);
  const [signOutBlockedPending, setSignOutBlockedPending] = useState(0);
  const [signOutBlockedUnsynced, setSignOutBlockedUnsynced] = useState(0);
  const [signOutBusy, setSignOutBusy] = useState(false);

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
        // Reachable only in a build with no Supabase: everywhere else the app
        // shows the sign-in screen instead of Settings (product-scope.md §2.6).
        <p className="text-sm text-muted-foreground">
          {isSupabaseConfigured
            ? t("auth.signOutBlocked.staySignedIn")
            : t("auth.syncNotConfigured")}
        </p>
      )}
    </SettingsSection>
  );
}
