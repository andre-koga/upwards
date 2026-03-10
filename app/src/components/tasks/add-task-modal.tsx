import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AddTaskModalProps {
  /** Called with the task title; return true on success to close the modal. */
  onAdd: (title: string) => Promise<boolean>;
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
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setAdding(true);
    const success = await onAdd(title);
    if (success) {
      setTitle("");
      setOpen(false);
    }
    setAdding(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" className="p-4">
          <DialogHeader>
            <DialogTitle>New one-time task</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Task title…"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={adding || !title.trim()}
            >
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={triggerTitle}
        className={
          triggerClassName ||
          "fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        }
      >
        {open ? <X className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </button>
    </>
  );
}
