import { FormDialog, FormDialogActions } from "@/components/forms";
import { db } from "@/lib/db";
import { logError } from "@/lib/error-utils";

interface DeleteMemoDialogProps {
  open: boolean;
  memoId: string | null;
  memoTitle: string | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

export function DeleteMemoDialog({
  open,
  memoId,
  memoTitle,
  onOpenChange,
  onDeleted,
  cancelLabel = "Cancel",
  confirmLabel = "Delete",
}: DeleteMemoDialogProps) {
  const handleDelete = async () => {
    if (!memoId) return;
    try {
      await db.oneTimeTasks.delete(memoId);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      logError("Error deleting memo", error);
    }
  };

  const displayTitle = memoTitle?.trim() || "this memo";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete memo?"
      description={`Delete "${displayTitle}"? This action cannot be undone.`}
    >
      <FormDialogActions
        onConfirm={handleDelete}
        confirmLabel={confirmLabel}
        confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
        secondaryAction={{
          label: cancelLabel,
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
