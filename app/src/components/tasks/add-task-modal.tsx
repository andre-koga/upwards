/**
 * SRP: Opens the memo creation flow from a floating trigger button.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MemoEditDialog } from "@/components/tasks/memo-edit-dialog";

interface AddTaskModalProps {
  /** Called with the task title and optional options; return true on success to close the modal. */
  onAdd: (
    title: string,
    options?: { due_date?: string | null; is_pinned?: boolean }
  ) => Promise<boolean>;
  triggerClassName?: string;
  triggerTitle?: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export default function AddTaskModal({
  onAdd,
  triggerClassName,
  triggerTitle = "Add one-time task",
  icon: Icon = Plus,
  disabled = false,
}: AddTaskModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("");
      setDueDate(null);
      setIsPinned(false);
    }
    setOpen(next);
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    setAdding(true);
    const success = await onAdd(title, {
      due_date: dueDate || null,
      is_pinned: isPinned,
    });
    if (success) {
      setTitle("");
      setDueDate(null);
      setIsPinned(false);
      setOpen(false);
    }
    setAdding(false);
  };

  return (
    <>
      <MemoEditDialog
        open={open}
        onOpenChange={handleOpenChange}
        dialogTitle="New memo"
        title={title}
        onTitleChange={setTitle}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        isPinned={isPinned}
        onPinnedChange={setIsPinned}
        onConfirm={handleAdd}
        confirmLabel="Add"
        confirmDisabled={adding || !title.trim()}
      />

      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={triggerTitle}
        className={
          triggerClassName ||
          "fixed bottom-3 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        }
      >
        {open ? <X className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </button>
    </>
  );
}
