import { useEffect, useState } from "react";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
import {
  appendActivityStatusEvent,
  appendGroupStatusEvent,
  stopCurrentActivity,
} from "@/lib/activity";
import { logError } from "@/lib/error-utils";
import {
  formatGoalModificationBlockMessage,
  getActiveGoalBlockingGroup,
  getActiveGoalForActivity,
} from "@/lib/promises/goal-eligibility";
import { useGoals } from "@/lib/promises/use-goals";
import { getCachedUserId } from "@/lib/supabase";

interface DeleteConfirmDialogProps {
  open: boolean;
  type: "activity" | "group" | null;
  id: string | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (detail: { type: "activity" | "group"; id: string }) => void;
}

export function DeleteConfirmDialog({
  open,
  type,
  id,
  onOpenChange,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const { goals } = useGoals();
  const userId = getCachedUserId();
  const [blockMessage, setBlockMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !id || !type) {
      setBlockMessage(null);
      return;
    }

    if (type === "activity") {
      const goal = getActiveGoalForActivity(id, goals, userId);
      setBlockMessage(
        goal ? formatGoalModificationBlockMessage(goal, "delete") : null
      );
      return;
    }

    void db.activities
      .filter((activity) => activity.group_id === id)
      .toArray()
      .then((activities) => {
        const goal = getActiveGoalBlockingGroup(id, activities, goals, userId);
        setBlockMessage(
          goal
            ? formatGoalModificationBlockMessage(goal, "delete", "group")
            : null
        );
      })
      .catch(console.error);
  }, [open, id, type, goals, userId]);

  const handleDelete = async () => {
    if (!id || !type || blockMessage) return;
    try {
      const n = now();
      const actionDate = new Date();
      if (type === "group") {
        await stopCurrentActivity({ groupId: id });
        const activities = await db.activities
          .filter((a) => a.group_id === id)
          .toArray();
        await appendGroupStatusEvent(id, "deleted", true, actionDate);
        await Promise.all(
          activities.map((a) =>
            appendActivityStatusEvent(a.id, "deleted", true, actionDate)
          )
        );
        await db.activities.bulkPut(
          activities.map((a) => ({ ...a, deleted_at: n, updated_at: n }))
        );
        await db.activityGroups.update(id, { deleted_at: n, updated_at: n });
      } else {
        await stopCurrentActivity({ activityId: id });
        await appendActivityStatusEvent(id, "deleted", true, actionDate);
        await db.activities.update(id, { deleted_at: n, updated_at: n });
      }
      onOpenChange(false);
      onDeleted({ type, id });
    } catch (error) {
      logError("Error deleting", error);
    }
  };

  const isGroup = type === "group";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        blockMessage
          ? "Active goal linked"
          : `Permanently Delete ${isGroup ? "Group" : "Activity"}?`
      }
      description={
        blockMessage ?? (
          <>
            This action cannot be undone. This will permanently delete the{" "}
            {isGroup ? "group and all activities in it" : "activity"}.
          </>
        )
      }
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={blockMessage ? () => onOpenChange(false) : handleDelete}
        confirmLabel={blockMessage ? "OK" : "Delete"}
        confirmDisabled={!blockMessage && (!id || !type)}
        confirmClassName={
          blockMessage
            ? undefined
            : "bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
        }
        secondaryAction={
          blockMessage
            ? undefined
            : {
                label: "Cancel",
                onClick: () => onOpenChange(false),
              }
        }
      />
    </FormDialog>
  );
}
