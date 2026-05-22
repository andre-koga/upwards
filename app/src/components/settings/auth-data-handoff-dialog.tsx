import { useEffect, useState } from "react";
import { CloudUpload, CloudDownload, Loader2 } from "lucide-react";
import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { onGuestHandoffNeeded } from "@/lib/sync/guest-handoff-emitter";
import { completeGuestHandoff } from "@/lib/sync/auth-handoff";
import type { GuestHandoffChoice } from "@/lib/sync/auth-handoff";

/**
 * Shown once when a guest user (no previous sign-in) signs in for the first
 * time and already has local habit data. Forces a choice before sync starts.
 * Cannot be dismissed without choosing — prevents accidental data overwrite.
 */
export function AuthDataHandoffDialog() {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onGuestHandoffNeeded((userId) => {
      setPendingUserId(userId);
    });
  }, []);

  const handleChoice = async (choice: GuestHandoffChoice) => {
    if (!pendingUserId || loading) return;
    setLoading(true);
    try {
      await completeGuestHandoff(pendingUserId, choice);
    } finally {
      setLoading(false);
      setPendingUserId(null);
    }
  };

  return (
    <FormDialog
      open={pendingUserId !== null}
      onOpenChange={() => {
        /* intentionally non-dismissible */
      }}
      title="You have local data"
      description="You created habits on this device before signing in. What would you like to do with them?"
      contentClassName="max-w-[calc(100%-2rem)] overflow-x-hidden sm:max-w-sm"
      descriptionClassName="text-pretty"
    >
      <div className="flex min-w-0 flex-col gap-3 pt-2">
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
      </div>
    </FormDialog>
  );
}
