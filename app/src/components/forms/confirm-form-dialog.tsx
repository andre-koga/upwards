import type { ReactNode } from "react";
import { FormDialog } from "@/components/forms/form-dialog";
import { FormDialogActions } from "@/components/forms/form-dialog-actions";
import { dialogPrimaryDestructiveClassName } from "@/components/forms/styles";

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

/** Shared shell for simple confirm/cancel dialogs: message plus two actions. */
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
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description ?? message}
      contentClassName={contentClassName}
    >
      <FormDialogActions
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        confirmDisabled={busy}
        confirmClassName={
          destructive ? dialogPrimaryDestructiveClassName : undefined
        }
        secondaryAction={{
          label: cancelLabel,
          onClick: () => onOpenChange(false),
        }}
      />
    </FormDialog>
  );
}
