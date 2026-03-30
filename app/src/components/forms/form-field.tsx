import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  dialogFieldClassName,
  dialogFieldLabelClassName,
} from "@/components/forms/styles";

export interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  message?: ReactNode;
  messageClassName?: string;
}

export function FormField({
  id,
  label,
  containerClassName,
  labelClassName,
  message,
  messageClassName,
  className,
  ...inputProps
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", containerClassName)}>
      <Label
        htmlFor={id}
        className={cn(dialogFieldLabelClassName, labelClassName)}
      >
        {label}
      </Label>
      <Input
        id={id}
        className={cn(dialogFieldClassName, className)}
        {...inputProps}
      />
      {message ? (
        <p className={cn("text-xs text-muted-foreground", messageClassName)}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
