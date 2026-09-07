import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dialogFieldClassName } from "@/components/forms/styles";
import { FormFieldShell } from "@/components/forms/form-field-shell";

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
    <FormFieldShell
      id={id}
      label={label}
      containerClassName={containerClassName}
      labelClassName={labelClassName}
      message={message}
      messageClassName={messageClassName}
    >
      <Input
        id={id}
        className={cn(dialogFieldClassName, className)}
        {...inputProps}
      />
    </FormFieldShell>
  );
}
