import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MemoEditDialog } from "@/components/tasks/memo-edit-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AddTaskModalProps {
  /** Called with the task title and optional options; return true on success to close the modal. */
  onAdd: (
    title: string,
    options?: { due_date?: string | null; is_pinned?: boolean }
  ) => Promise<boolean>;
  triggerClassName?: string;
  triggerTitle?: string;
  /** Shown next to the icon inside the trigger (wider layouts). */
  triggerLabel?: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export default function AddTaskModal({
  onAdd,
  triggerClassName,
  triggerTitle = "Add one-time task",
  triggerLabel,
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

      <Button
        type="button"
        variant="default"
        size={triggerLabel ? "default" : "floatingNav"}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={triggerTitle}
        aria-label={triggerTitle}
        className={cn(
          !triggerLabel &&
            "fixed bottom-2 right-2 z-[60] gap-0 px-0 text-primary-foreground shadow-md hover:bg-primary/90",
          triggerLabel && "rounded-full shadow-md",
          triggerClassName
        )}
      >
        {triggerLabel ? (
          <span className="flex items-center justify-center gap-2">
            {open ? (
              <X className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
            )}
            <span className="text-sm font-semibold">
              {open ? "Close" : triggerLabel}
            </span>
          </span>
        ) : open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Icon className="h-5 w-5" aria-hidden />
        )}
      </Button>
    </>
  );
}
