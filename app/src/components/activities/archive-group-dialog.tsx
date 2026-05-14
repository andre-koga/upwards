import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
import { stopCurrentActivity } from "@/lib/activity";
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
      await db.activityGroups.update(groupId, {
        is_archived: true,
        updated_at: n,
      });
      const groupActivities = await db.activities
        .filter((activity) => activity.group_id === groupId && !activity.deleted_at)
        .toArray();
      await Promise.all(
        groupActivities.map((activity) =>
          db.activities.update(activity.id, {
            is_archived: true,
            updated_at: n,
          })
        )
      );
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
      title="Archive group"
      description={
        <>
          Are you sure you want to archive &quot;{displayName}&quot;? This will
          remove it from your active groups list. You can restore it from the
          activity picker: open Archived at the bottom of the groups list.
        </>
      }
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={handleArchive}
        confirmLabel={confirmLabel}
        confirmDisabled={!groupId}
        confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
        secondaryAction={{
          label: cancelLabel,
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
