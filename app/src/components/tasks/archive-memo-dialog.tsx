import { useTranslation } from "react-i18next";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { db, now } from "@/lib/db";
import { logError } from "@/lib/error-utils";

interface ArchiveMemoDialogProps {
  open: boolean;
  memoId: string | null;
  memoTitle: string | null;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

export function ArchiveMemoDialog({
  open,
  memoId,
  memoTitle,
  onOpenChange,
  onArchived,
  cancelLabel,
  confirmLabel,
}: ArchiveMemoDialogProps) {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const handleArchive = async () => {
    if (!memoId) return;
    try {
      const n = now();
      await db.oneTimeTasks.update(memoId, {
        is_archived: true,
        updated_at: n,
      });
      onOpenChange(false);
      onArchived();
    } catch (error) {
      logError("Error archiving memo", error);
    }
  };

  const displayTitle = memoTitle?.trim() || t("memo.thisMemo");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("memo.archiveConfirm.title")}
      description={t("memo.archiveConfirm.description", { title: displayTitle })}
    >
      <FormDialogActions
        onConfirm={handleArchive}
        confirmLabel={confirmLabel ?? t("memo.archiveConfirm.confirm")}
        secondaryAction={{
          label: cancelLabel ?? tCommon("cancel"),
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
