/**
 * SRP: Renders a tappable task completion control with optional custom complete/incomplete content.
 */
import { memo } from "react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TaskCheckboxProps {
  isComplete: boolean;
  isToday: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  title?: string;
  className?: string;
  completeContent?: ReactNode;
  incompleteContent?: ReactNode;
}

function TaskCheckbox({
  isComplete,
  isToday,
  onClick,
  size = "md",
  title,
  className,
  completeContent,
  incompleteContent,
}: TaskCheckboxProps) {
  const sizeClass = size === "sm" ? "h-6 w-6" : "h-7 w-[2.75rem]";

  return (
    <button
      onClick={isToday ? onClick : undefined}
      disabled={!isToday}
      className={cn(
        "flex items-center justify-center rounded-full border transition-colors",
        sizeClass,
        isComplete
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground text-muted-foreground",
        "disabled:cursor-default disabled:opacity-60",
        className
      )}
      title={
        title ??
        (isToday
          ? isComplete
            ? "Mark incomplete"
            : "Mark complete"
          : undefined)
      }
    >
      {isComplete
        ? (completeContent ?? <Check className="h-4 w-4" />)
        : (incompleteContent ?? null)}
    </button>
  );
}

export default memo(TaskCheckbox);
