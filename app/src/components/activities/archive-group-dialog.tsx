import { ConfirmFormDialog } from "@/components/forms";
import { appendGroupStatusEvent, stopCurrentActivity } from "@/lib/activity";
import { logError } from "@/lib/error-utils";
import { patchActivityGroup } from "@/lib/sync/mutate-synced";

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
      await appendGroupStatusEvent(groupId, "archived", true);
      await patchActivityGroup(groupId, {
        is_archived: true,
      });
      onOpenChange(false);
      onArchived();
    } catch (error) {
      logError("Error archiving group", error);
    }
  };

  const displayName = groupName?.trim() || "this group";

  return (
    <ConfirmFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Archive group?"
      message={`Archive "${displayName}"? Activities in this group will be hidden from For Today until you restore the group.`}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={() => void handleArchive()}
    />
  );
}
