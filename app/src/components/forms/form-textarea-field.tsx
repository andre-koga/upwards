import type { ComponentProps, ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { dialogTextareaClassName } from "@/components/forms/styles";
import { FormFieldShell } from "@/components/forms/form-field-shell";

export interface FormTextareaFieldProps extends ComponentProps<
  typeof Textarea
> {
  id: string;
  label: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  message?: ReactNode;
  messageClassName?: string;
}

export function FormTextareaField({
  id,
  label,
  containerClassName,
  labelClassName,
  message,
  messageClassName,
  className,
  ...textareaProps
}: FormTextareaFieldProps) {
  return (
    <FormFieldShell
      id={id}
      label={label}
      containerClassName={containerClassName}
      labelClassName={labelClassName}
      message={message}
      messageClassName={messageClassName}
    >
      <Textarea
        id={id}
        className={cn(dialogTextareaClassName, className)}
        {...textareaProps}
      />
    </FormFieldShell>
  );
}
