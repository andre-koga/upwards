import type { ComponentProps, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  dialogFieldLabelClassName,
  dialogTextareaClassName,
} from "@/components/forms/styles";

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
    <div className={cn("space-y-1", containerClassName)}>
      <Label
        htmlFor={id}
        className={cn(dialogFieldLabelClassName, labelClassName)}
      >
        {label}
      </Label>
      <Textarea
        id={id}
        className={cn(dialogTextareaClassName, className)}
        {...textareaProps}
      />
      {message ? (
        <p className={cn("text-xs text-muted-foreground", messageClassName)}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
