import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { OneTimeTask } from "@/lib/db/types";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { db, now } from "@/lib/db";
import { logError } from "@/lib/error-utils";
import { formatDateShort, fromDateString } from "@/lib/time-utils";
import { Undo2, Trash2 } from "lucide-react";

interface ArchivedMemosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archivedMemos: OneTimeTask[];
  onMemoRestored?: () => void;
}

export function ArchivedMemosDialog({
  open,
  onOpenChange,
  archivedMemos: initialArchivedMemos,
  onMemoRestored,
}: ArchivedMemosDialogProps) {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archivedMemos, setArchivedMemos] = useState(initialArchivedMemos);
  const [prevInitialArchivedMemos, setPrevInitialArchivedMemos] =
    useState(initialArchivedMemos);

  if (initialArchivedMemos !== prevInitialArchivedMemos) {
    setPrevInitialArchivedMemos(initialArchivedMemos);
    setArchivedMemos(initialArchivedMemos);
  }

  const handleRestore = async (memoId: string) => {
    setRestoringId(memoId);
    try {
      const n = now();
      await db.oneTimeTasks.update(memoId, {
        is_archived: false,
        updated_at: n,
      });
      setArchivedMemos((prev) => prev.filter((m) => m.id !== memoId));
      onMemoRestored?.();
    } catch (error) {
      logError("Error restoring memo", error);
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (memoId: string) => {
    try {
      await db.oneTimeTasks.delete(memoId);
      setArchivedMemos((prev) => prev.filter((m) => m.id !== memoId));
      onMemoRestored?.();
    } catch (error) {
      logError("Error deleting memo", error);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        archivedMemos.length > 0
          ? t("memo.archivedDialog.titleWithCount", {
              count: archivedMemos.length,
            })
          : t("memo.archivedDialog.title")
      }
      size="default"
      contentClassName="w-96"
    >
      <div className="max-h-96 space-y-1 overflow-y-auto">
        {archivedMemos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("memo.archivedDialog.empty")}
          </p>
        ) : (
          archivedMemos.map((memo) => (
            <div
              key={memo.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words font-medium">
                  {memo.title}
                </p>
                {memo.due_date && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("memo.due", {
                      date: formatDateShort(fromDateString(memo.due_date)),
                    })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRestore(memo.id)}
                  disabled={restoringId === memo.id}
                  className="h-6 w-6"
                  title={t("memo.archivedDialog.restore")}
                  aria-label={t("memo.archivedDialog.restore")}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(memo.id)}
                  disabled={restoringId === memo.id}
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  title={t("memo.archivedDialog.delete")}
                  aria-label={t("memo.archivedDialog.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      <FormDialogActions
        onConfirm={() => onOpenChange(false)}
        confirmLabel={tCommon("close")}
        secondaryAction={undefined}
      />
    </FormDialog>
  );
}
