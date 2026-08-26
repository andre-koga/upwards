import { useTranslation } from "react-i18next";
import { ConfirmFormDialog } from "@/components/forms";
import { now } from "@/lib/db";
import { logError } from "@/lib/error-utils";
import { patchOneTimeTask } from "@/lib/sync/mutate-synced";

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
      await patchOneTimeTask(memoId, { deleted_at: n, updated_at: n });
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      logError("Error deleting memo", error);
    }
  };

  const displayTitle = memoTitle?.trim() || t("memo.thisMemo");

  return (
    <ConfirmFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("memo.deleteConfirm.title")}
      message={t("memo.deleteConfirm.description", { title: displayTitle })}
      confirmLabel={confirmLabel ?? tCommon("delete")}
      cancelLabel={cancelLabel ?? tCommon("cancel")}
      destructive
      onConfirm={() => void handleDelete()}
    />
  );
}
