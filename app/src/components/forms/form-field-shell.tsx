import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { dialogFieldLabelClassName } from "@/components/forms/styles";

interface FormFieldShellProps {
  id: string;
  label: ReactNode;
  children: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  message?: ReactNode;
  messageClassName?: string;
}

/** Shared label, spacing, and supporting-message structure for form controls. */
export function FormFieldShell({
  id,
  label,
  children,
  containerClassName,
  labelClassName,
  message,
  messageClassName,
}: FormFieldShellProps) {
  return (
    <div className={cn("space-y-1", containerClassName)}>
      <Label
        htmlFor={id}
        className={cn(dialogFieldLabelClassName, labelClassName)}
      >
        {label}
      </Label>
      {children}
      {message ? (
        <p className={cn("text-xs text-muted-foreground", messageClassName)}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
