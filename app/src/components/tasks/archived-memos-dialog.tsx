import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { OneTimeTask } from "@/lib/db/types";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { now } from "@/lib/db";
import { logError } from "@/lib/error-utils";
import { formatDateShort, fromDateString } from "@/lib/time-utils";
import { Undo2, Trash2 } from "lucide-react";
import { patchOneTimeTask } from "@/lib/sync/mutate-synced";

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
      await patchOneTimeTask(memoId, {
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
      const n = now();
      await patchOneTimeTask(memoId, { deleted_at: n, updated_at: n });
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
    >
      <div className="max-h-96 overflow-y-auto">
        {archivedMemos.length === 0 ? (
          <p className="py-8 text-center font-display text-[1.0625rem] italic text-muted-foreground">
            {t("memo.archivedDialog.empty")}
          </p>
        ) : (
          <div className="divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl bg-muted/45">
            {archivedMemos.map((memo) => (
              <div
                key={memo.id}
                className="flex min-h-[3.25rem] items-center justify-between gap-2 py-2.5 pl-4 pr-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-snug">
                    {memo.title}
                  </p>
                  {memo.due_date && (
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
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
                    className="h-9 w-9 rounded-full"
                    title={t("memo.archivedDialog.restore")}
                    aria-label={t("memo.archivedDialog.restore")}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(memo.id)}
                    disabled={restoringId === memo.id}
                    className="h-9 w-9 rounded-full text-destructive hover:text-destructive"
                    title={t("memo.archivedDialog.delete")}
                    aria-label={t("memo.archivedDialog.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
