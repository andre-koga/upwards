import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
import { appendGroupStatusEvent, stopCurrentActivity } from "@/lib/activity";
import { logError } from "@/lib/error-utils";

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
  const handleArchive = async () => {
    if (!groupId) return;
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
      title="Archive group?"
      description={`Archive "${displayName}"? Activities in this group will be hidden from For Today until you restore the group.`}
    >
      <FormDialogActions
        onConfirm={handleArchive}
        confirmLabel={confirmLabel}
        secondaryAction={{
          label: cancelLabel,
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
