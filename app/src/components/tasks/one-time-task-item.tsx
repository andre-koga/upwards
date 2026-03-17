import { memo, useState } from "react";
import { Pin } from "lucide-react";
import type { OneTimeTask } from "@/lib/db/types";
import TaskCheckbox from "@/components/tasks/task-checkbox";
import Pill from "@/components/ui/pill";
import { MemoEditDialog } from "@/components/tasks/memo-edit-dialog";
import { formatDateShort, fromDateString } from "@/lib/date-utils";

const MEMO_PILL_COLOR = "var(--memo-pill-color)";
const MEMO_PILL_TEXT = "var(--memo-pill-text)";

function getDueDateDisplayLabel(dueDate: string): string {
  const due = fromDateString(dueDate);
  const dueMs = due.getTime();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayMs = yesterday.getTime();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowMs = tomorrow.getTime();

  if (dueMs < yesterdayMs) return "Past";
  if (dueMs === yesterdayMs) return "Yesterday";
  if (dueMs === todayMs) return "Today";
  if (dueMs === tomorrowMs) return "Tomorrow";
  return formatDateShort(due);
}

interface OneTimeTaskItemProps {
  task: OneTimeTask;
  isToday: boolean;
  onToggle: (task: OneTimeTask) => void;
  onDelete: (taskId: string) => void;
  onUpdate: (
    taskId: string,
    patch: Partial<Pick<OneTimeTask, "title" | "is_pinned" | "due_date">>
  ) => Promise<boolean>;
  timeSpent?: number;
  isCurrentMemo?: boolean;
  onStartMemo?: (memoId: string) => void;
  onStopMemo?: () => void;
}

function OneTimeTaskItem({
  task,
  isToday,
  onToggle,
  onDelete,
  onUpdate,
  timeSpent = 0,
  isCurrentMemo = false,
  onStartMemo,
  onStopMemo,
}: OneTimeTaskItemProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDueDate, setDraftDueDate] = useState<string | null>(
    task.due_date
  );
  const [draftPinned, setDraftPinned] = useState(!!task.is_pinned);
  const [saving, setSaving] = useState(false);

  const handleOpenEdit = (open: boolean) => {
    if (open) {
      setDraftTitle(task.title);
      setDraftDueDate(task.due_date);
      setDraftPinned(!!task.is_pinned);
    }
    setEditOpen(open);
  };

  const handleSave = async () => {
    if (!draftTitle.trim()) return;
    setSaving(true);
    const success = await onUpdate(task.id, {
      title: draftTitle.trim(),
      due_date: draftDueDate || null,
      is_pinned: draftPinned,
    });
    if (success) setEditOpen(false);
    setSaving(false);
  };

  const handleDelete = () => {
    onDelete(task.id);
    setEditOpen(false);
  };

  const handleTogglePin = () => {
    void onUpdate(task.id, { is_pinned: !task.is_pinned });
  };

  const dueDateDisplay = task.due_date
    ? getDueDateDisplayLabel(task.due_date)
    : null;

  const showTimer = isToday && (onStartMemo || onStopMemo);

  const pinButton = isToday && (
    <button
      type="button"
      aria-label={task.is_pinned ? "Unpin memo" : "Pin memo"}
      onClick={(e) => {
        e.stopPropagation();
        handleTogglePin();
      }}
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center transition-colors ${
        task.is_pinned
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Pin className={`h-3.5 w-3.5 ${task.is_pinned ? "fill-current" : ""}`} />
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      <div className="shrink-0">
        <TaskCheckbox
          isComplete={!!task.is_completed}
          isToday={isToday}
          onClick={() => onToggle(task)}
          size="sm"
        />
      </div>

      {showTimer ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center">
            <Pill
              name={
                dueDateDisplay
                  ? dueDateDisplay + " - " + task.title
                  : task.title
              }
              color={MEMO_PILL_COLOR}
              textColor={MEMO_PILL_TEXT}
              elapsedMs={timeSpent}
              isRunning={isCurrentMemo}
              onPlayStop={
                isCurrentMemo ? onStopMemo : () => onStartMemo?.(task.id)
              }
              onNameClick={isToday ? () => setEditOpen(true) : undefined}
              nameClassName={
                task.is_completed ? "line-through text-muted-foreground" : ""
              }
              size="sm"
              readOnly={!isToday}
              className="flex-1"
            />
            {pinButton}
          </div>
        </div>
      ) : (
        <div
          className="relative flex min-h-8 min-w-0 flex-1 cursor-pointer flex-col overflow-hidden rounded-2xl border border-border"
          onClick={isToday ? () => setEditOpen(true) : undefined}
          onKeyDown={
            isToday
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditOpen(true);
                  }
                }
              : undefined
          }
          role={isToday ? "button" : undefined}
          tabIndex={isToday ? 0 : undefined}
        >
          <div className="flex items-start gap-2">
            <span
              className={`min-w-0 flex-1 break-words px-4 py-2 text-left text-sm font-medium ${
                task.is_completed ? "text-muted-foreground line-through" : ""
              }`}
            >
              {task.title}
            </span>
            {pinButton}
          </div>
          {dueDateDisplay && (
            <span className="px-4 pb-2 text-xs text-muted-foreground">
              Due {dueDateDisplay}
            </span>
          )}
        </div>
      )}

      <MemoEditDialog
        open={editOpen}
        onOpenChange={handleOpenEdit}
        title={draftTitle}
        onTitleChange={setDraftTitle}
        dueDate={draftDueDate}
        onDueDateChange={setDraftDueDate}
        isPinned={draftPinned}
        onPinnedChange={setDraftPinned}
        onConfirm={handleSave}
        onDelete={handleDelete}
        confirmLabel="Save"
        confirmDisabled={saving || !draftTitle.trim()}
      />
    </div>
  );
}

export default memo(OneTimeTaskItem);
