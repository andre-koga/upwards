import { useEffect, useState } from "react";
import {
  CloudUpload,
  CloudDownload,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { onGuestHandoffNeeded } from "@/lib/sync/guest-handoff-emitter";
import type { HandoffRequest } from "@/lib/sync/guest-handoff-emitter";
import {
  completeGuestHandoff,
  discardPreviousAccountData,
} from "@/lib/sync/auth-handoff";
import type { GuestHandoffChoice } from "@/lib/sync/auth-handoff";
import { supabase } from "@/lib/supabase";
import { dialogPrimaryDestructiveClassName } from "@/components/forms/styles";

/**
 * Blocks sync until the user resolves an ambiguous local-data situation.
 *
 * Two cases, both non-dismissible because the wrong default destroys data:
 *
 * - `guest_data`: a guest signs in for the first time with local habits. Upload
 *   them, or replace them with the account's data.
 * - `account_switch_unsynced`: a *different* account was signed in on this device
 *   and left behind changes the server never accepted. This case used to have no
 *   dialog at all — the switch wiped every synced table plus the pending-op queue
 *   on its own. Uploading is not offered here: those rows belong to the previous
 *   account, so pushing them into this one would merge two people's data.
 */
export function AuthDataHandoffDialog() {
  const [request, setRequest] = useState<HandoffRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    return onGuestHandoffNeeded((next) => {
      setConfirmDiscard(false);
      setRequest(next);
    });
  }, []);

  const handleChoice = async (choice: GuestHandoffChoice) => {
    if (!request || loading) return;
    setLoading(true);
    try {
      await completeGuestHandoff(request.userId, choice);
    } finally {
      setLoading(false);
      setRequest(null);
    }
  };

  const handleDiscardPrevious = async () => {
    if (!request || loading) return;
    setLoading(true);
    try {
      await discardPreviousAccountData(request.userId);
    } finally {
      setLoading(false);
      setConfirmDiscard(false);
      setRequest(null);
    }
  };

  // Signing out leaves local data untouched, which is exactly what makes the
  // recovery possible: the user signs back in as the previous account and syncs.
  const handleSignOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await supabase?.auth.signOut();
    } finally {
      setLoading(false);
      setConfirmDiscard(false);
      setRequest(null);
    }
  };

  const isAccountSwitch = request?.reason === "account_switch_unsynced";

  return (
    <FormDialog
      open={request !== null}
      onOpenChange={() => {
        /* intentionally non-dismissible */
      }}
      title={
        isAccountSwitch
          ? "Unsaved changes from another account"
          : "You have local data"
      }
      description={
        isAccountSwitch
          ? "A different account was signed in on this device and left changes that never reached the cloud. Signing in here would erase them. Sign back in to that account to save them first, or discard them permanently."
          : "You created habits on this device before signing in. What would you like to do with them?"
      }
      contentClassName="max-w-[calc(100%-2rem)] overflow-x-hidden sm:max-w-sm"
      descriptionClassName="text-pretty"
    >
      <div className="flex min-w-0 flex-col gap-3 pt-2">
        {isAccountSwitch ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="flex h-auto w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal rounded-xl px-4 py-3 text-left"
              disabled={loading}
              onClick={handleSignOut}
            >
              {loading ? (
                <Loader2 className="mb-1 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <CloudUpload className="mb-1 h-4 w-4 shrink-0" />
              )}
              <span className="w-full min-w-0 text-pretty text-sm font-semibold">
                Sign out and keep the changes
              </span>
              <span className="w-full min-w-0 text-pretty text-xs text-muted-foreground">
                Nothing is deleted. Sign back in to the other account to save
                them, or export a backup from Settings.
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={
                confirmDiscard
                  ? `flex h-auto w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal rounded-xl px-4 py-3 text-left ${dialogPrimaryDestructiveClassName}`
                  : "flex h-auto w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal rounded-xl px-4 py-3 text-left"
              }
              disabled={loading}
              onClick={() => {
                if (confirmDiscard) {
                  void handleDiscardPrevious();
                  return;
                }
                setConfirmDiscard(true);
              }}
            >
              {loading ? (
                <Loader2 className="mb-1 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <TriangleAlert className="mb-1 h-4 w-4 shrink-0" />
              )}
              <span className="w-full min-w-0 text-pretty text-sm font-semibold">
                {confirmDiscard
                  ? "Tap again to permanently delete them"
                  : "Discard the changes and continue"}
              </span>
              <span className="w-full min-w-0 text-pretty text-xs text-muted-foreground">
                {confirmDiscard
                  ? "This cannot be undone."
                  : "Erase this device's unsaved changes and load your account's data"}
              </span>
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="flex h-auto w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal rounded-xl px-4 py-3 text-left"
              disabled={loading}
              onClick={() => handleChoice("upload_local")}
            >
              {loading ? (
                <Loader2 className="mb-1 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <CloudUpload className="mb-1 h-4 w-4 shrink-0" />
              )}
              <span className="w-full min-w-0 text-pretty text-sm font-semibold">
                Upload this device&apos;s data
              </span>
              <span className="w-full min-w-0 text-pretty text-xs text-muted-foreground">
                Add what&apos;s on this device to your account
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex h-auto w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal rounded-xl px-4 py-3 text-left"
              disabled={loading}
              onClick={() => handleChoice("use_cloud")}
            >
              {loading ? (
                <Loader2 className="mb-1 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <CloudDownload className="mb-1 h-4 w-4 shrink-0" />
              )}
              <span className="w-full min-w-0 text-pretty text-sm font-semibold">
                Use my account&apos;s data
              </span>
              <span className="w-full min-w-0 text-pretty text-xs text-muted-foreground">
                Replace local data with what&apos;s saved in your account
              </span>
            </Button>
          </>
        )}
      </div>
    </FormDialog>
  );
}
