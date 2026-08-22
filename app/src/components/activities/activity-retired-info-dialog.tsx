import { FormDialog, FormDialogActions } from "@/components/forms";

export type ActivityRetiredKind = "deleted" | "archived";

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
      title={isDeleted ? "Activity deleted" : "Activity archived"}
      description={
        isDeleted ? (
          <>
            &quot;{displayName}&quot; has been deleted. You can still see it on
            past days where you tracked it, but editing is no longer available.
          </>
        ) : (
          <>
            &quot;{displayName}&quot; has been archived. You can still see it on
            past days where you tracked it. Restore it from the archived list in
            the group drawer.
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
