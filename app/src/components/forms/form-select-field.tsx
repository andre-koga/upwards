import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  dialogFieldLabelClassName,
  dialogSelectTriggerClassName,
} from "@/components/forms/styles";

interface FormSelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface FormSelectFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
  message?: ReactNode;
  messageClassName?: string;
}

export function FormSelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  containerClassName,
  labelClassName,
  triggerClassName,
  contentClassName,
  message,
  messageClassName,
}: FormSelectFieldProps) {
  return (
    <div className={cn("space-y-1", containerClassName)}>
      <Label
        htmlFor={id}
        className={cn(dialogFieldLabelClassName, labelClassName)}
      >
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn(dialogSelectTriggerClassName, triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {message ? (
        <p className={cn("text-xs text-muted-foreground", messageClassName)}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
