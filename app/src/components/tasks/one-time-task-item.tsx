import { memo } from "react";
import { Trash2 } from "lucide-react";
import type { OneTimeTask } from "@/lib/db/types";
import TaskCheckbox from "@/components/tasks/task-checkbox";

interface OneTimeTaskItemProps {
  task: OneTimeTask;
  isToday: boolean;
  onToggle: (task: OneTimeTask) => void;
  onDelete: (taskId: string) => void;
}

function OneTimeTaskItem({
  task,
  isToday,
  onToggle,
  onDelete,
}: OneTimeTaskItemProps) {
  return (
    <div className="flex items-center gap-2">
      <TaskCheckbox
        isComplete={task.is_completed}
        isToday={isToday}
        onClick={() => onToggle(task)}
        size="sm"
      />

      <div className="relative flex h-8 flex-1 items-center overflow-hidden rounded-full border border-border">
        <label
          onClick={isToday ? () => onToggle(task) : undefined}
          className={`flex-1 truncate px-4 text-left text-sm font-medium ${
            task.is_completed ? "text-muted-foreground line-through" : ""
          } ${isToday ? "cursor-pointer" : "cursor-default"}`}
        >
          {task.title}
        </label>

        {isToday && (
          <button
            type="button"
            aria-label="Delete quick task"
            className="relative mr-0.5 flex h-9 flex-shrink-0 items-center justify-center rounded-full px-3 text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(OneTimeTaskItem);
