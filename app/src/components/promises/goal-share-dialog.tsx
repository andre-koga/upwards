import { useState } from "react";
import { Users, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { FormDialog, FormDialogActions } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useGoals } from "@/lib/promises/use-goals";
import { useFriends } from "@/lib/friends/use-friends";
import { useUserProfile } from "@/lib/use-user-profile";
import type { GoalShare, GoalWithShares } from "@/lib/db/types";
import { viewerDisplayLabel } from "@/lib/promises/goal-display";

interface GoalShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalWithShares | undefined;
  onChanged?: () => void;
}

function shareLabel(share: GoalShare): string {
  return viewerDisplayLabel(share.display_name ?? null, share.username ?? null);
}

export function GoalShareDialog({
  open,
  onOpenChange,
  goal,
  onChanged,
}: GoalShareDialogProps) {
  const navigate = useNavigate();
  const { shareGoal, unshareGoal } = useGoals();
  const { friends } = useFriends();
  const { username, loading: profileLoading } = useUserProfile();
  const [sharing, setSharing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const activeShares = goal?.shares.filter((s) => s.status !== "declined") ?? [];

  const shareableFriends = friends.filter((f) => {
    if (!goal) return false;
    const friendId = f.profile?.userId;
    if (!friendId) return false;
    return !activeShares.some((s) => s.viewer_user_id === friendId);
  });

  const handleShare = async (friendUserId: string) => {
    if (!goal) return;
    setSharing(friendUserId);
    try {
      await shareGoal(goal.id, friendUserId);
      onChanged?.();
    } finally {
      setSharing(null);
    }
  };

  const handleUnshare = async (shareId: string) => {
    setRemoving(shareId);
    try {
      await unshareGoal(shareId);
      onChanged?.();
    } finally {
      setRemoving(null);
    }
  };

  return (
    <FormDialog
      open={open && goal !== undefined}
      onOpenChange={onOpenChange}
      title="Share with friends"
      description="Friends can cheer you on and hold you accountable."
    >
      <div className="space-y-4 py-1">
        {!profileLoading && !username && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Set a{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                onOpenChange(false);
                navigate("/settings");
              }}
            >
              username in Settings
            </button>{" "}
            before you can share goals.
          </div>
        )}

        {activeShares.length > 0 && (
          <ul className="space-y-2">
            {activeShares.map((share) => (
              <li
                key={share.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{shareLabel(share)}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {share.status === "pending" ? "Invite pending" : "Watching"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={removing === share.id}
                  onClick={() => void handleUnshare(share.id)}
                  aria-label={`Stop sharing with ${shareLabel(share)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {shareableFriends.length === 0 ? (
          <div className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
            <p>No friends to share with</p>
            <button
              type="button"
              className="mt-1 text-xs underline"
              onClick={() => {
                onOpenChange(false);
                navigate("/friends");
              }}
            >
              Add friends first
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {shareableFriends.map((f) => {
              const uid =
                f.profile?.userId ?? (f.user_a === "" ? f.user_b : f.user_a);
              const label = f.profile?.displayName ?? f.profile?.username
                ? `${f.profile.displayName ?? ""} (@${f.profile.username ?? ""})`
                : "Unknown";
              return (
                <li
                  key={uid}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <Button
                    size="sm"
                    disabled={sharing === uid}
                    onClick={() => void handleShare(uid)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Share
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <FormDialogActions onConfirm={() => onOpenChange(false)} confirmLabel="Done" />
    </FormDialog>
  );
}
