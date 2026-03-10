import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Activity</DialogTitle>
          <DialogDescription>
            Are you sure you want to archive "{activityName}"? This will remove
            it from your active activities list.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleArchive}>Archive</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
