import { useEffect, useState } from "react";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/db/types";
import { buildInviteUrl } from "@/lib/promises/use-promises";
import { getActivityDisplayName } from "@/lib/activity";
import { Copy, Check } from "lucide-react";
import { db } from "@/lib/db";

interface CreatePromiseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: Activity[];
  onCreated: (params: {
    title: string;
    mode: "mutual" | "witness";
    activityId: string;
    inviteEmail?: string;
  }) => Promise<{ promiseId: string; token: string }>;
}

type Step = "form" | "invite";

export function CreatePromiseDialog({
  open,
  onOpenChange,
  activities,
  onCreated,
}: CreatePromiseDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [mode, setMode] = useState<"mutual" | "witness">("mutual");
  const [activityId, setActivityId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [groups, setGroups] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- intentionally re-initialize draft state when dialog opens */
    setStep("form");
    setMode("mutual");
    setActivityId(activities[0]?.id ?? "");
    setInviteEmail("");
    setError(null);
    setSaving(false);
    setInviteUrl("");
    setCopied(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, activities]);

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

  const selectedActivity = activities.find((a) => a.id === activityId);
  const title = selectedActivity
    ? getActivityDisplayName(selectedActivity, {
        id: selectedActivity.group_id,
        name: groups[selectedActivity.group_id] ?? "",
        emoji: null,
        color: null,
        order_index: null,
        is_archived: false,
        created_at: "",
        updated_at: "",
        synced_at: null,
        deleted_at: null,
      })
    : "";

  const handleCreate = async () => {
    if (!activityId) {
      setError("Pick a habit to promise.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onCreated({
        title,
        mode,
        activityId,
        inviteEmail: inviteEmail.trim() || undefined,
      });
      setInviteUrl(buildInviteUrl(result.token));
      setStep("invite");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create promise");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "invite") {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Promise created!"
        description="Share this link with the person you're making this promise with. They'll need to sign in to accept."
        contentClassName="sm:max-w-md"
      >
        <FormStack>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3">
            <p className="min-w-0 flex-1 truncate text-xs font-mono text-muted-foreground">
              {inviteUrl}
            </p>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <FormDialogActions
            onConfirm={() => onOpenChange(false)}
            confirmLabel="Done"
            secondaryAction={undefined}
          />
        </FormStack>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New promise"
      description="Choose a habit and invite your accountability partner."
      contentClassName="sm:max-w-md"
    >
      <FormStack>
        {/* Habit picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Habit</p>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active habits. Create a habit first.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
              {activities.map((a) => {
                const groupName = groups[a.group_id] ?? "";
                const name =
                  a.name ??
                  groupName;
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
                    <span>{name}</span>
                    {groupName && a.name && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {groupName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Mode</p>
          <div className="flex gap-2">
            {(["mutual", "witness"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  mode === m
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border hover:bg-muted/60"
                )}
                onClick={() => setMode(m)}
              >
                <p className="font-medium capitalize">{m}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m === "mutual"
                    ? "Both commit to the same habit"
                    : "You commit; they hold you accountable"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Optional email invite */}
        <FormField
          id="invite-email"
          label="Invite by email (optional)"
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="partner@example.com"
          message="We'll generate a link either way."
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <FormDialogActions
          onConfirm={handleCreate}
          confirmLabel={saving ? "Creating…" : "Create & get invite link"}
          confirmDisabled={saving || !activityId}
          secondaryAction={{
            label: "Cancel",
            onClick: () => onOpenChange(false),
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
