import { useState, useEffect } from "react";
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
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archivedMemos, setArchivedMemos] = useState(initialArchivedMemos);

  useEffect(() => {
    setArchivedMemos(initialArchivedMemos);
  }, [initialArchivedMemos]);

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
      title={`Archived Memos${archivedMemos.length > 0 ? ` (${archivedMemos.length})` : ""}`}
      size="default"
      contentClassName="w-96"
    >
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {archivedMemos.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No archived memos
          </p>
        ) : (
          archivedMemos.map((memo) => (
            <div
              key={memo.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words whitespace-pre-wrap">{memo.title}</p>
                {memo.due_date && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due {formatDateShort(fromDateString(memo.due_date))}
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
                  title="Restore memo"
                  aria-label="Restore memo"
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
                  title="Delete memo"
                  aria-label="Delete memo"
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
        confirmLabel="Close"
        secondaryAction={undefined}
      />
    </FormDialog>
  );
}
