import { useEffect, useState } from "react";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
import { appendGroupStatusEvent, stopCurrentActivity } from "@/lib/activity";
import { logError } from "@/lib/error-utils";
import {
  formatGoalModificationBlockMessage,
  getActiveGoalBlockingGroup,
} from "@/lib/promises/goal-eligibility";
import { useGoals } from "@/lib/promises/use-goals";
import { getCachedUserId } from "@/lib/supabase";

interface ArchiveGroupDialogProps {
  open: boolean;
  groupId: string | null;
  groupName: string | null;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

export function ArchiveGroupDialog({
  open,
  groupId,
  groupName,
  onOpenChange,
  onArchived,
  cancelLabel = "Cancel",
  confirmLabel = "Archive",
}: ArchiveGroupDialogProps) {
  const { goals } = useGoals();
  const userId = getCachedUserId();
  const [blockMessage, setBlockMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !groupId) {
      setBlockMessage(null);
      return;
    }

    void db.activities
      .filter((activity) => activity.group_id === groupId)
      .toArray()
      .then((activities) => {
        const goal = getActiveGoalBlockingGroup(
          groupId,
          activities,
          goals,
          userId
        );
        setBlockMessage(
          goal ? formatGoalModificationBlockMessage(goal, "archive", "group") : null
        );
      })
      .catch(console.error);
  }, [open, groupId, goals, userId]);

  const handleArchive = async () => {
    if (!groupId || blockMessage) return;
    try {
      await stopCurrentActivity({ groupId });
      const n = now();
      await appendGroupStatusEvent(groupId, "archived", true);
      await db.activityGroups.update(groupId, {
        is_archived: true,
        updated_at: n,
      });
      onOpenChange(false);
      onArchived();
    } catch (error) {
      logError("Error archiving group", error);
    }
  };

  const displayName = groupName?.trim() || "this group";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={blockMessage ? "Active goal linked" : "Archive group"}
      description={
        blockMessage ?? (
          <>
            Are you sure you want to archive &quot;{displayName}&quot;? This will
            remove it from your active groups list. You can restore it from the
            activity picker: open Archived at the bottom of the groups list.
          </>
        )
      }
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={blockMessage ? () => onOpenChange(false) : handleArchive}
        confirmLabel={blockMessage ? "OK" : confirmLabel}
        confirmDisabled={!blockMessage && !groupId}
        confirmClassName={
          blockMessage
            ? undefined
            : "bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
        }
        secondaryAction={
          blockMessage
            ? undefined
            : {
                label: cancelLabel,
                onClick: () => onOpenChange(false),
              }
        }
      />
    </FormDialog>
  );
}
