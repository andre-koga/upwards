import { memo, useEffect, useRef, useState } from "react";
import type { OneTimeTask } from "@/lib/db/types";
import TaskCheckbox from "@/components/tasks/task-checkbox";
import Pill from "@/components/ui/pill";
import { MemoEditDialog } from "@/components/tasks/memo-edit-dialog";
import { HOLD_ACTION_DELAY_MS } from "@/lib/consts";
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

  const memoLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const memoLongPressFiredRef = useRef(false);
  const suppressNextMemoClickRef = useRef(false);

  useEffect(() => {
    return () => {
      if (memoLongPressTimerRef.current != null) {
        clearTimeout(memoLongPressTimerRef.current);
      }
    };
  }, []);

  const clearMemoLongPressTimer = () => {
    if (memoLongPressTimerRef.current != null) {
      clearTimeout(memoLongPressTimerRef.current);
      memoLongPressTimerRef.current = null;
    }
  };

  const handleMemoPointerDown = () => {
    if (!isToday) return;
    clearMemoLongPressTimer();
    memoLongPressFiredRef.current = false;
    memoLongPressTimerRef.current = setTimeout(() => {
      memoLongPressTimerRef.current = null;
      memoLongPressFiredRef.current = true;
      suppressNextMemoClickRef.current = true;
      handleTogglePin();
    }, HOLD_ACTION_DELAY_MS);
  };

  const handleMemoPointerUp = () => {
    clearMemoLongPressTimer();
  };

  const handleMemoPointerCancel = () => {
    clearMemoLongPressTimer();
  };

  const handleMemoClick = () => {
    if (!isToday) return;
    if (suppressNextMemoClickRef.current || memoLongPressFiredRef.current) {
      suppressNextMemoClickRef.current = false;
      memoLongPressFiredRef.current = false;
      return;
    }
    setEditOpen(true);
  };

  const dueDateDisplay = task.due_date
    ? getDueDateDisplayLabel(task.due_date)
    : null;

  const showTimer = isToday && (onStartMemo || onStopMemo);
  const memoBorderClass = task.is_pinned ? "border-primary" : "border-border";

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
              onNameClick={isToday ? handleMemoClick : undefined}
              onNamePointerDown={isToday ? handleMemoPointerDown : undefined}
              onNamePointerUp={isToday ? handleMemoPointerUp : undefined}
              onNameContextMenu={
                isToday ? (e) => e.preventDefault() : undefined
              }
              onNamePointerCancel={
                isToday ? handleMemoPointerCancel : undefined
              }
              nameClassName={
                task.is_completed ? "line-through text-muted-foreground" : ""
              }
              size="sm"
              readOnly={!isToday}
              className={`flex-1 ${memoBorderClass}`}
            />
          </div>
        </div>
      ) : (
        <div
          className={`relative flex min-h-8 min-w-0 flex-1 cursor-pointer flex-col overflow-hidden rounded-2xl border ${memoBorderClass}`}
          onClick={isToday ? handleMemoClick : undefined}
          onPointerDown={isToday ? handleMemoPointerDown : undefined}
          onPointerUp={isToday ? handleMemoPointerUp : undefined}
          onPointerLeave={isToday ? handleMemoPointerCancel : undefined}
          onPointerCancel={isToday ? handleMemoPointerCancel : undefined}
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
