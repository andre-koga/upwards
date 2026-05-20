import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
import { stopCurrentActivity } from "@/lib/activity";
import { logError } from "@/lib/error-utils";

interface MarkDoneActivityDialogProps {
  open: boolean;
  activityId: string | null;
  activityName: string | null;
  onOpenChange: (open: boolean) => void;
  onMarkedDone: () => void;
}

export function MarkDoneActivityDialog({
  open,
  activityId,
  activityName,
  onOpenChange,
  onMarkedDone,
}: MarkDoneActivityDialogProps) {
  const handleMarkDone = async () => {
    if (!activityId) return;
    try {
      await stopCurrentActivity({ activityId });
      const n = now();
      await db.activities.update(activityId, {
        completed_at: n,
        updated_at: n,
      });
      onOpenChange(false);
      onMarkedDone();
    } catch (error) {
      logError("Error marking activity as done", error);
    }
  };

  const displayName = activityName?.trim() || "this activity";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mark as done"
      description={
        <>
          Mark &quot;{displayName}&quot; as completed? This hides it from your
          daily list like a finished goal. You can still see its history. To
          resume tracking, restore it from the archived section.
        </>
      }
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={handleMarkDone}
        confirmLabel="Mark as done"
        confirmDisabled={!activityId}
        secondaryAction={{
          label: "Cancel",
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
