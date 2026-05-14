import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
import { stopCurrentActivity } from "@/lib/activity";
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
      await stopCurrentActivity({ activityId });
      const n = now();
      await db.activities.update(activityId, {
        is_archived: true,
        updated_at: n,
      });
      onOpenChange(false);
      onArchived();
    } catch (error) {
      logError("Error archiving activity", error);
    }
  };

  const displayName = activityName?.trim() || "this activity";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Archive Activity"
      description={
        <>
          Are you sure you want to archive &quot;{displayName}&quot;? This will
          remove it from your active activities list. You can restore it from
          the Archived section at the bottom of this group&apos;s list in the
          activity picker.
        </>
      }
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={handleArchive}
        confirmLabel={confirmLabel}
        confirmDisabled={!activityId}
        confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
        secondaryAction={{
          label: cancelLabel,
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
