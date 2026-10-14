import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { dialogSelectTriggerClassName } from "@/components/forms/styles";

interface SettingsSelectOption {
  value: string;
  label: ReactNode;
  icon?: LucideIcon;
}

interface SettingsSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SettingsSelectOption[];
  /** Accessible name; the visible label is a separate element. */
  ariaLabel: string;
  className?: string;
}

/**
 * A choice among a few options in Settings. It is the shared `Select`, with
 * the same trigger chrome as the selects in dialogs, so every dropdown on the
 * platform looks and behaves alike. Do not use `DropdownMenu` for this: its
 * trigger opens on pointer-down, so a finger that lands on it to start a
 * scroll opens the menu. `Select` opens a touch on release instead.
 */
export function SettingsSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: SettingsSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(dialogSelectTriggerClassName, className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6}>
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <SelectItem key={optionValue} value={optionValue}>
            {Icon ? (
              <Icon className="text-muted-foreground" aria-hidden />
            ) : null}
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
