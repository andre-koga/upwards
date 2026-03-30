import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => onToggle(!toggled)}
      aria-label={label}
      aria-pressed={toggled}
      className={cn(
        "shrink-0 border transition-colors",
        toggled
          ? "border-primary bg-primary/20 text-primary hover:bg-primary/25"
          : "border-border text-muted-foreground hover:text-foreground",
        toggled ? activeClassName : inactiveClassName,
        className
      )}
    >
      {children ?? label}
    </Button>
  );
}
