import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InputPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  placeholder?: string;
  inputType?: "text" | "url";
  inputReadOnly?: boolean;
  confirmDisabled?: boolean;
  /** Optional secondary action (e.g. Clear) shown above the confirm button */
  secondaryAction?: {
    label: React.ReactNode;
    onClick: () => void;
    className?: string;
    disabled?: boolean;
  };
  inputClassName?: string;
  contentClassName?: string;
}

export function InputPromptDialog({
  open,
  onOpenChange,
  title,
  value,
  onChange,
  onConfirm,
  confirmLabel = "Save",
  placeholder,
  inputType = "text",
  inputReadOnly = false,
  confirmDisabled = false,
  secondaryAction,
  inputClassName,
  contentClassName,
}: InputPromptDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !confirmDisabled) {
      e.preventDefault();
      onConfirm();
    }
    if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className={cn("w-80 p-4", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={inputReadOnly}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary",
            inputClassName
          )}
        />
        <div className="flex items-center justify-center gap-3 pt-2">
          {secondaryAction && (
            <Button
              type="button"
              variant="secondary"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className={cn(
                "gap-1 rounded-full px-5 py-2.5 font-semibold shadow-md hover:text-destructive",
                secondaryAction.className
              )}
            >
              {secondaryAction.label}
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="w-full max-w-[12rem] rounded-full px-5 py-2.5 font-semibold shadow-md"
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
