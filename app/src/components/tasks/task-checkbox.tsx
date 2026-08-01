import { memo } from "react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TaskCheckboxProps {
  isComplete: boolean;
  isToday: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  title?: string;
  className?: string;
  completeContent?: ReactNode;
  incompleteContent?: ReactNode;
  disabled?: boolean;
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
  disabled = false,
}: TaskCheckboxProps) {
  const isInteractive = isToday && !disabled;
  const actionLabel =
    title ?? (isComplete ? "Mark incomplete" : "Mark complete");

  return (
    <Button
      type="button"
      variant={isComplete ? "taskComplete" : "taskTodo"}
      size={size === "sm" ? "taskSm" : "taskMd"}
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={cn("disabled:cursor-default", className)}
      title={title ?? (isToday ? actionLabel : undefined)}
      aria-label={actionLabel}
    >
      {isComplete
        ? (completeContent ?? <Check className="h-4 w-4" />)
        : (incompleteContent ?? null)}
    </Button>
  );
}

export default memo(TaskCheckbox);
