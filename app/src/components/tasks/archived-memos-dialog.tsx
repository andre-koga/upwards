import { useState } from "react";
import type { OneTimeTask } from "@/lib/db/types";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { db, now } from "@/lib/db";
import { logError } from "@/lib/error-utils";
import { formatDateShort, fromDateString } from "@/lib/time-utils";

interface ArchivedMemosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archivedMemos: OneTimeTask[];
  onMemoRestored?: () => void;
}

export function ArchivedMemosDialog({
  open,
  onOpenChange,
  archivedMemos,
  onMemoRestored,
}: ArchivedMemosDialogProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (memoId: string) => {
    setRestoringId(memoId);
    try {
      const n = now();
      await db.oneTimeTasks.update(memoId, {
        is_archived: false,
        updated_at: n,
      });
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
      onMemoRestored?.();
    } catch (error) {
      logError("Error deleting memo", error);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Archived Memos"
      size="default"
      contentClassName="w-96"
    >
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {archivedMemos.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No archived memos
          </p>
        ) : (
          archivedMemos.map((memo) => (
            <div
              key={memo.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{memo.title}</p>
                {memo.due_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Due {formatDateShort(fromDateString(memo.due_date))}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestore(memo.id)}
                  disabled={restoringId === memo.id}
                  className="text-xs"
                >
                  Restore
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(memo.id)}
                  disabled={restoringId === memo.id}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      <FormDialogActions
        onConfirm={() => onOpenChange(false)}
        confirmLabel="Close"
        secondaryAction={undefined}
      />
    </FormDialog>
  );
}
