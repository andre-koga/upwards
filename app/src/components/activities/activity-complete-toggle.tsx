import { memo } from "react";
import { Check } from "lucide-react";
import TaskCheckbox from "@/components/tasks/task-checkbox";

interface ActivityCompleteToggleProps {
  isCompleted: boolean;
  onClick: () => void;
}

/**
 * Circular toggle for marking an activity permanently done or reactivating it.
 * Uses TaskCheckbox (taskSm — 28×28, rounded-full) but with a distinct complete
 * icon (Check) and muted-secondary colors so it cannot be confused with
 * the For Today daily-completion checkbox (taskMd, primary colors).
 */
function ActivityCompleteToggle({
  isCompleted,
  onClick,
}: ActivityCompleteToggleProps) {
  return (
    <TaskCheckbox
      isComplete={isCompleted}
      isToday={true}
      size="sm"
      onClick={onClick}
      title={isCompleted ? "Mark habit active again" : "Mark habit completed"}
      completeContent={<Check className="h-3.5 w-3.5" aria-hidden />}
      className={
        isCompleted
          ? "border-muted-foreground bg-muted-foreground text-background hover:bg-muted-foreground/80"
          : "border-muted-foreground/50 text-muted-foreground/50 hover:border-muted-foreground hover:text-muted-foreground"
      }
    />
  );
}

export default memo(ActivityCompleteToggle);
