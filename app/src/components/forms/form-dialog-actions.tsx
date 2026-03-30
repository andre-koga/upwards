import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  dialogActionContainerClassName,
  dialogPrimaryActionClassName,
  dialogSecondaryActionClassName,
  dialogSecondaryDestructiveClassName,
} from "@/components/forms/styles";

export interface FormDialogSecondaryAction {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}

export interface FormDialogActionsProps {
  onConfirm: () => void;
  confirmLabel?: ReactNode;
  confirmDisabled?: boolean;
  secondaryAction?: FormDialogSecondaryAction;
  containerClassName?: string;
  confirmClassName?: string;
}

export function FormDialogActions({
  onConfirm,
  confirmLabel = "Save",
  confirmDisabled = false,
  secondaryAction,
  containerClassName,
  confirmClassName,
}: FormDialogActionsProps) {
  return (
    <div className={cn(dialogActionContainerClassName, containerClassName)}>
      {secondaryAction ? (
        <Button
          type="button"
          variant="secondary"
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.disabled}
          className={cn(
            dialogSecondaryActionClassName,
            secondaryAction.destructive && dialogSecondaryDestructiveClassName,
            secondaryAction.className
          )}
        >
          {secondaryAction.label}
        </Button>
      ) : null}
      <Button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className={cn(dialogPrimaryActionClassName, confirmClassName)}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
