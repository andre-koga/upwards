import { FormDialog, FormDialogActions } from "@/components/forms";

export type ActivityRetiredKind = "deleted" | "completed";

interface ActivityRetiredInfoDialogProps {
  open: boolean;
  kind: ActivityRetiredKind | null;
  activityName: string;
  onOpenChange: (open: boolean) => void;
}

export function ActivityRetiredInfoDialog({
  open,
  kind,
  activityName,
  onOpenChange,
}: ActivityRetiredInfoDialogProps) {
  const displayName = activityName.trim() || "This activity";
  const isDeleted = kind === "deleted";

  return (
    <FormDialog
      open={open && kind !== null}
      onOpenChange={onOpenChange}
      title={isDeleted ? "Activity deleted" : "Activity completed"}
      description={
        isDeleted ? (
          <>
            &quot;{displayName}&quot; has been deleted. You can still see it on
            past days where you tracked it, but goals and settings are no longer
            available.
          </>
        ) : (
          <>
            &quot;{displayName}&quot; has been marked as completed. You can
            still see it on past days where you tracked it, but goals and
            settings are no longer available.
          </>
        )
      }
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={() => onOpenChange(false)}
        confirmLabel="OK"
      />
    </FormDialog>
  );
}
