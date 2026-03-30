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
  return (
    <Button
      type="button"
      variant={isComplete ? "taskComplete" : "taskTodo"}
      size={size === "sm" ? "taskSm" : "taskMd"}
      onClick={isToday ? onClick : undefined}
      disabled={!isToday}
      className={cn("disabled:cursor-default disabled:opacity-60", className)}
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
    </Button>
  );
}

export default memo(TaskCheckbox);
