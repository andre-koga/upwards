import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { db, now } from "@/lib/db";
import { stopCurrentActivity } from "@/lib/activity-utils";
import { logError } from "@/lib/error-utils";

interface ArchiveActivityDialogProps {
  open: boolean;
  activityId: string | null;
  activityName: string | null;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
}

export function ArchiveActivityDialog({
  open,
  activityId,
  activityName,
  onOpenChange,
  onArchived,
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

  return (
    <AlertDialog
      open={open}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Activity</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to archive "{activityName}"? This will remove
            it from your active activities list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
