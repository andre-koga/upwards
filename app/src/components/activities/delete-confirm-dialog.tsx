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
import { db } from "@/lib/db";
import { stopCurrentActivity } from "@/lib/activity-utils";
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
    <AlertDialog
      open={open}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Permanently Delete {type === "group" ? "Group" : "Activity"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the{" "}
            {type === "group" ? "group and all activities in it" : "activity"}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
