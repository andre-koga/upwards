import { useEffect, useState } from "react";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/db/types";
import { lookupPromiseForInvite } from "@/lib/promises/use-promises";
import { getActivityDisplayName } from "@/lib/activity";
import { db } from "@/lib/db";

interface AcceptInviteDialogProps {
  open: boolean;
  token: string;
  onTokenChange: (token: string) => void;
  onOpenChange: (open: boolean) => void;
  activities: Activity[];
  onAccepted: (token: string, activityId?: string) => Promise<void>;
}

type Step = "token" | "confirm" | "accepting";

export function AcceptInviteDialog({
  open,
  token,
  onTokenChange,
  onOpenChange,
  activities,
  onAccepted,
}: AcceptInviteDialogProps) {
  const [step, setStep] = useState<Step>("token");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [promiseInfo, setPromiseInfo] = useState<Awaited<
    ReturnType<typeof lookupPromiseForInvite>
  > | null>(null);
  const [activityId, setActivityId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset dialog state when closed */
      setStep("token");
      setPromiseInfo(null);
      setActivityId("");
      setError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  useEffect(() => {
     
    db.activityGroups
      .filter((g) => !g.deleted_at)
      .toArray()
      .then((gs) => {
        const map: Record<string, string> = {};
        for (const g of gs) map[g.id] = g.name;
        setGroups(map);
      })
      .catch(console.error);
  }, []);

  const cleanToken = (raw: string) => {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split("/");
      return parts[parts.length - 1] ?? raw;
    } catch {
      return raw.trim();
    }
  };

  const handleLookup = async () => {
    setError(null);
    setLookupLoading(true);
    try {
      const clean = cleanToken(token);
      const info = await lookupPromiseForInvite(clean);
      if (!info) {
        setError("Invite not found. Check the link and try again.");
        return;
      }
      if (info.invite.accepted_at) {
        setError("This invite has already been used.");
        return;
      }
      setPromiseInfo(info);
      setActivityId(activities[0]?.id ?? "");
      setStep("confirm");
    } catch {
      setError("Failed to look up invite.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!promiseInfo) return;
    setError(null);
    setStep("accepting");
    try {
      const clean = cleanToken(token);
      await onAccepted(
        clean,
        promiseInfo.invite.mode === "mutual" ? activityId : undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join promise");
      setStep("confirm");
    }
  };

  const isMutual = promiseInfo?.invite.mode === "mutual";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Join a promise"
      description={
        step === "token"
          ? "Paste an invite link or code from your accountability partner."
          : step === "confirm"
            ? `"${promiseInfo?.promise.title}" — ${isMutual ? "mutual commitment" : "witness"}`
            : "Joining…"
      }
      contentClassName="sm:max-w-md"
    >
      <FormStack>
        {step === "token" && (
          <>
            <FormField
              id="join-token"
              label="Invite link or code"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="https://… or just the code"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <FormDialogActions
              onConfirm={handleLookup}
              confirmLabel={lookupLoading ? "Looking up…" : "Next"}
              confirmDisabled={lookupLoading || !token.trim()}
              secondaryAction={{
                label: "Cancel",
                onClick: () => onOpenChange(false),
              }}
            />
          </>
        )}

        {step === "confirm" && promiseInfo && (
          <>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{promiseInfo.promise.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                {isMutual ? "Mutual — you'll both track this habit" : "Witness — you'll track their progress"}
              </p>
            </div>

            {isMutual && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Your habit for this promise
                </p>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active habits. Create one first.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                    {activities.map((a) => {
                      const name = getActivityDisplayName(a, {
                        id: a.group_id,
                        name: groups[a.group_id] ?? "",
                        emoji: null,
                        color: null,
                        order_index: null,
                        is_archived: false,
                        created_at: "",
                        updated_at: "",
                        synced_at: null,
                        deleted_at: null,
                      });
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={cn(
                            "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            activityId === a.id
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "border-border hover:bg-muted/60"
                          )}
                          onClick={() => setActivityId(a.id)}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <FormDialogActions
              onConfirm={handleAccept}
              confirmLabel="Accept promise"
              confirmDisabled={isMutual && !activityId}
              secondaryAction={{
                label: "Back",
                onClick: () => setStep("token"),
              }}
            />
          </>
        )}

        {step === "accepting" && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Joining…
          </p>
        )}
      </FormStack>
    </FormDialog>
  );
}
