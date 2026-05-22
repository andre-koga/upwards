import { FormDialog, FormDialogActions } from "@/components/forms";

interface GoalModificationBlockDialogProps {
  open: boolean;
  message: string | null;
  onOpenChange: (open: boolean) => void;
}

export function GoalModificationBlockDialog({
  open,
  message,
  onOpenChange,
}: GoalModificationBlockDialogProps) {
  return (
    <FormDialog
      open={open && !!message}
      onOpenChange={onOpenChange}
      title="Active goal linked"
      description={message ?? undefined}
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={() => onOpenChange(false)}
        confirmLabel="OK"
      />
    </FormDialog>
  );
}
