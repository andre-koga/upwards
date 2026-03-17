/**
 * SRP: Renders a reusable boolean toggle button for form controls.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormToggleButtonProps {
  toggled: boolean;
  onToggle: (next: boolean) => void;
  label: string;
  children?: ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

export function FormToggleButton({
  toggled,
  onToggle,
  label,
  children,
  className,
  activeClassName,
  inactiveClassName,
}: FormToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!toggled)}
      aria-label={label}
      aria-pressed={toggled}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
        toggled
          ? "border-primary bg-primary/20 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
        toggled ? activeClassName : inactiveClassName,
        className
      )}
    >
      {children ?? label}
    </button>
  );
}
