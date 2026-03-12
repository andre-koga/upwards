import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Pin } from "lucide-react";

interface MemoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  dueDate: string | null;
  onDueDateChange: (value: string | null) => void;
  isPinned: boolean;
  onPinnedChange: (value: boolean) => void;
  onConfirm: () => void;
  onDelete: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

export function MemoEditDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  dueDate,
  onDueDateChange,
  isPinned,
  onPinnedChange,
  onConfirm,
  onDelete,
  confirmLabel = "Save",
  confirmDisabled = false,
}: MemoEditDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onConfirm();
    }
    if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="w-80 p-4">
        <DialogHeader>
          <DialogTitle>Edit memo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            autoFocus
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task title…"
            rows={3}
            className={cn(
              "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            )}
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dueDate ?? ""}
              onChange={(e) => onDueDateChange(e.target.value || null)}
              className={cn(
                "flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
            <button
              type="button"
              onClick={() => onPinnedChange(!isPinned)}
              aria-label={isPinned ? "Unpin memo" : "Pin memo"}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                isPinned
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground shadow-md transition-colors hover:bg-secondary/90 hover:text-destructive"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              "w-full max-w-[12rem] rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
