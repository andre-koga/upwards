import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { stopCurrentActivity } from "@/lib/activity";
import { logError } from "@/lib/error-utils";

interface DeleteConfirmDialogProps {
  open: boolean;
  type: "activity" | "group" | null;
  id: string | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
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
      if (type === "group") {
        await stopCurrentActivity({ groupId: id });
        const activities = await db.activities
          .filter((a) => a.group_id === id)
          .toArray();
        await db.activities.bulkDelete(activities.map((a) => a.id));
        await db.activityGroups.delete(id);
      } else {
        await stopCurrentActivity({ activityId: id });
        await db.activities.delete(id);
      }
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      logError("Error deleting", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Permanently Delete {type === "group" ? "Group" : "Activity"}?
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the{" "}
            {type === "group" ? "group and all activities in it" : "activity"}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
