import { memo } from "react";
import { Check } from "lucide-react";

interface TaskCheckboxProps {
  isComplete: boolean;
  isToday: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  title?: string;
}

function TaskCheckbox({
  isComplete,
  isToday,
  onClick,
  size = "md",
  title,
}: TaskCheckboxProps) {
  const sizeClass = size === "sm" ? "h-6 w-6" : "h-7 w-[2.75rem]";

  return (
    <button
      onClick={isToday ? onClick : undefined}
      disabled={!isToday}
      className={`flex items-center justify-center rounded-full border transition-colors ${sizeClass} ${
        isComplete
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground text-muted-foreground"
      } disabled:cursor-default disabled:opacity-60`}
      title={
        title ??
        (isToday
          ? isComplete
            ? "Mark incomplete"
            : "Mark complete"
          : undefined)
      }
    >
      {isComplete && <Check className="h-4 w-4" />}
    </button>
  );
}

export default memo(TaskCheckbox);
