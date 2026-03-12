import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  const [adding, setAdding] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("");
      setDueDate(null);
    }
    setOpen(next);
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    setAdding(true);
    const success = await onAdd(title, {
      due_date: dueDate || null,
    });
    if (success) {
      setTitle("");
      setDueDate(null);
      setOpen(false);
    }
    setAdding(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="sm" className="w-80 p-4">
          <DialogHeader>
            <DialogTitle>New memo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
                if (e.key === "Escape") handleOpenChange(false);
              }}
              placeholder="Task title…"
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
            <input
              type="date"
              value={dueDate ?? ""}
              onChange={(e) => setDueDate(e.target.value || null)}
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
          </div>
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !title.trim()}
              className={cn(
                "w-full max-w-[12rem] rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              Add
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
