import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Check, Trash2 } from "lucide-react";
import type { OneTimeTask } from "@/lib/db/types";

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
    <div className="flex items-center gap-3 p-3 border rounded-md hover:bg-accent">
      <button
        onClick={isToday ? () => onToggle(task) : undefined}
        disabled={!isToday}
        className={`flex items-center justify-center h-6 w-6 rounded-full border transition-colors ${
          task.is_completed
            ? "bg-primary text-primary-foreground border-primary"
            : "border-muted-foreground text-muted-foreground"
        } disabled:opacity-60 disabled:cursor-default`}
        title={
          isToday
            ? task.is_completed
              ? "Mark incomplete"
              : "Mark complete"
            : undefined
        }
      >
        {task.is_completed && <Check className="h-3 w-3" />}
      </button>
      <label
        onClick={isToday ? () => onToggle(task) : undefined}
        className={`flex-1 text-sm ${
          task.is_completed ? "line-through text-muted-foreground" : ""
        } ${isToday ? "cursor-pointer" : "cursor-default"}`}
      >
        {task.title}
      </label>
      {isToday && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default memo(OneTimeTaskItem);
