import { useTranslation } from "react-i18next";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
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
  cancelLabel,
  confirmLabel,
}: DeleteMemoDialogProps) {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const handleDelete = async () => {
    if (!memoId) return;
    try {
      const n = now();
      // Soft delete so recurring spawn idempotency still sees today's instance.
      await db.oneTimeTasks.update(memoId, { deleted_at: n, updated_at: n });
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      logError("Error deleting memo", error);
    }
  };

  const displayTitle = memoTitle?.trim() || t("memo.thisMemo");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("memo.deleteConfirm.title")}
      description={t("memo.deleteConfirm.description", { title: displayTitle })}
    >
      <FormDialogActions
        onConfirm={handleDelete}
        confirmLabel={confirmLabel ?? tCommon("delete")}
        confirmClassName="bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive"
        secondaryAction={{
          label: cancelLabel ?? tCommon("cancel"),
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
