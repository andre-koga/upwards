import { ConfirmFormDialog } from "@/components/forms";
import { db, now } from "@/lib/db";
import {
  appendActivityStatusEvent,
  appendGroupStatusEvent,
  stopCurrentActivity,
} from "@/lib/activity";
import { logError } from "@/lib/error-utils";

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
  const handleDelete = async () => {
    if (!id || !type) return;
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
    <ConfirmFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Permanently Delete ${isGroup ? "Group" : "Activity"}?`}
      message={
        <>
          This action cannot be undone. This will permanently delete the{" "}
          {isGroup ? "group and all activities in it" : "activity"}.
        </>
      }
      confirmLabel="Delete"
      destructive
      busy={!id || !type}
      onConfirm={() => void handleDelete()}
      contentClassName="sm:max-w-md"
    />
  );
}
