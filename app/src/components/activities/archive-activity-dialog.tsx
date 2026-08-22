import { ConfirmFormDialog } from "@/components/forms";
import { archiveActivityById } from "@/lib/activity";
import { logError } from "@/lib/error-utils";

interface ArchiveActivityDialogProps {
  open: boolean;
  activityId: string | null;
  activityName: string | null;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

export function ArchiveActivityDialog({
  open,
  activityId,
  activityName,
  onOpenChange,
  onArchived,
  cancelLabel = "Cancel",
  confirmLabel = "Archive",
}: ArchiveActivityDialogProps) {
  const handleArchive = async () => {
    if (!activityId) return;
    try {
      await archiveActivityById(activityId);
      onOpenChange(false);
      onArchived();
    } catch (error) {
      logError("Error archiving activity", error);
    }
  };

  const displayName = activityName?.trim() || "this activity";

  return (
    <ConfirmFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Archive activity?"
      message={`Archive "${displayName}"? It will be hidden from For Today until you restore it.`}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={() => void handleArchive()}
    />
  );
}
