import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { dialogPrimaryDestructiveClassName } from "@/components/forms/styles";
import { cn } from "@/lib/utils";

interface ConfirmFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Confirmation copy; rendered as the dialog description unless `description` is given. */
  message: ReactNode;
  /** Overrides the dialog-header description (defaults to `message`). */
  description?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  /** Style the confirm action as destructive (delete permanently, etc.). */
  destructive?: boolean;
  onConfirm: () => void;
  /** Disables the confirm action (e.g. while the action runs or input is missing). */
  busy?: boolean;
  contentClassName?: string;
}

/** Shared shell for simple confirm/cancel dialogs via AlertDialog. */
export function ConfirmFormDialog({
  open,
  onOpenChange,
  title,
  message,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  busy = false,
  contentClassName,
}: ConfirmFormDialogProps) {
  const body = description ?? message;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={contentClassName}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{body}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={cn(
              destructive ? dialogPrimaryDestructiveClassName : undefined
            )}
            onClick={(event) => {
              // Keep dialog open until the caller finishes (busy) or closes.
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
