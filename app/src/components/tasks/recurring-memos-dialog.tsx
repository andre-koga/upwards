import { useEffect, useState } from "react";
import type { RecurringMemo } from "@/lib/db/types";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { formatRoutineDisplay } from "@/lib/activity";
import { Plus, Pencil } from "lucide-react";
import { RecurringMemoEditDialog } from "./recurring-memo-edit-dialog";
import { useRecurringMemos } from "./hooks/use-recurring-memos";

interface RecurringMemosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPresetsChanged?: () => void;
}

export function RecurringMemosDialog({
  open,
  onOpenChange,
  onPresetsChanged,
}: RecurringMemosDialogProps) {
  const {
    recurringMemos,
    loadRecurringMemos,
    createRecurringMemo,
    updateRecurringMemo,
    deleteRecurringMemo,
  } = useRecurringMemos();
  const [editOpen, setEditOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<RecurringMemo | null>(null);

  useEffect(() => {
    if (open) {
      void loadRecurringMemos();
    }
  }, [open, loadRecurringMemos]);

  const handleSaved = async () => {
    onPresetsChanged?.();
  };

  const openCreate = () => {
    setEditingMemo(null);
    setEditOpen(true);
  };

  const openEdit = (memo: RecurringMemo) => {
    setEditingMemo(memo);
    setEditOpen(true);
  };

  const handleSave = async (values: {
    title: string;
    routine: string;
    is_pinned: boolean;
  }) => {
    const ok = editingMemo
      ? await updateRecurringMemo(editingMemo.id, values)
      : await createRecurringMemo(values.title, {
          routine: values.routine,
          is_pinned: values.is_pinned,
        });
    if (ok) await handleSaved();
    return ok;
  };

  const handleDelete = async () => {
    if (!editingMemo) return;
    await deleteRecurringMemo(editingMemo.id);
    setEditOpen(false);
    await handleSaved();
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Recurring Memos${recurringMemos.length > 0 ? ` (${recurringMemos.length})` : ""}`}
        size="default"
        contentClassName="w-96"
        headerEnd={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={openCreate}
            title="New recurring memo"
            aria-label="New recurring memo"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        }
      >
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {recurringMemos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No recurring memos yet
            </p>
          ) : (
            recurringMemos.map((memo) => (
              <div
                key={memo.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words whitespace-pre-wrap">
                    {memo.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRoutineDisplay(memo.routine)}
                    {memo.is_enabled === false ? " · Paused" : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(memo)}
                  className="h-6 w-6 shrink-0"
                  title="Edit recurring memo"
                  aria-label="Edit recurring memo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
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

      <RecurringMemoEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        memo={editingMemo}
        onSave={handleSave}
        onDelete={editingMemo ? () => void handleDelete() : undefined}
      />
    </>
  );
}
