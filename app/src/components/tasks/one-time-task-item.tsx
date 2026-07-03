import { memo, useEffect, useRef, useState } from "react";
import { useTranslation, type TFunction } from "react-i18next";
import type { OneTimeTask } from "@/lib/db/types";
import { Pin, RefreshCw } from "lucide-react";
import TaskCheckbox from "@/components/tasks/task-checkbox";
import { MemoEditDialog } from "@/components/tasks/memo-edit-dialog";
import { ArchiveMemoDialog } from "@/components/tasks/archive-memo-dialog";
import { DeleteMemoDialog } from "@/components/tasks/delete-memo-dialog";
import { HOLD_ACTION_DELAY_MS } from "@/lib/constants";
import { formatDateShort, fromDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";

function getDueDateDisplayLabel(dueDate: string, t: TFunction<"tasks">): string {
  const due = fromDateString(dueDate);
  const dueMs = due.getTime();

  const today = fromDateString(getEffectiveToday());
  const todayMs = today.getTime();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayMs = yesterday.getTime();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowMs = tomorrow.getTime();

  if (dueMs < yesterdayMs) return t("memo.dueLabels.past");
  if (dueMs === yesterdayMs) return t("memo.dueLabels.yesterday");
  if (dueMs === todayMs) return t("memo.dueLabels.today");
  if (dueMs === tomorrowMs) return t("memo.dueLabels.tomorrow");
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
  onArchive?: (taskId: string) => void;
}

function OneTimeTaskItem({
  task,
  isToday,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
}: OneTimeTaskItemProps) {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const [editOpen, setEditOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
      setArchiveConfirmOpen(false);
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
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setEditOpen(false);
    onDelete(task.id);
  };

  const handleArchiveClick = () => {
    setArchiveConfirmOpen(true);
  };

  const handleArchiveConfirm = () => {
    setArchiveConfirmOpen(false);
    setEditOpen(false);
    onArchive?.(task.id);
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
    ? getDueDateDisplayLabel(task.due_date, t)
    : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <TaskCheckbox
          isComplete={!!task.is_completed}
          isToday={isToday}
          onClick={() => onToggle(task)}
          incompleteContent={
            task.is_pinned ? (
              <Pin className="h-3 w-3 fill-current" aria-hidden />
            ) : undefined
          }
          title={
            task.is_pinned
              ? isToday
                ? task.is_completed
                  ? t("memo.pinnedMarkIncomplete")
                  : t("memo.pinnedMarkComplete")
                : t("memo.pinnedMemo")
              : undefined
          }
        />

        <div
          className="flex min-h-8 min-w-0 flex-1 cursor-pointer flex-col overflow-hidden rounded-xl border border-border"
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
          <p
            className={`min-w-0 flex-1 break-words whitespace-pre-wrap px-3 py-2 text-left text-sm font-medium ${
              task.is_completed ? "text-muted-foreground line-through" : ""
            }`}
          >
            {task.title}
          </p>
          {dueDateDisplay || task.recurring_memo_id ? (
            <div className="flex items-center justify-between gap-2 px-3 pb-2">
              {dueDateDisplay ? (
                <span className="min-w-0 text-xs text-muted-foreground">
                  {t("memo.due", { date: dueDateDisplay })}
                </span>
              ) : (
                <span />
              )}
              {task.recurring_memo_id ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium leading-none text-muted-foreground shadow-sm"
                  title={t("memo.recurringMemo")}
                  aria-label={t("memo.recurringMemo")}
                >
                  <RefreshCw className="h-3 w-3 shrink-0" aria-hidden />
                  {t("memo.recurring")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

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
        onArchive={handleArchiveClick}
        confirmLabel={tCommon("save")}
        confirmDisabled={saving || !draftTitle.trim()}
      />

      <ArchiveMemoDialog
        open={editOpen && archiveConfirmOpen}
        memoId={task.id}
        memoTitle={task.title}
        onOpenChange={setArchiveConfirmOpen}
        onArchived={handleArchiveConfirm}
      />

      <DeleteMemoDialog
        open={deleteConfirmOpen}
        memoId={task.id}
        memoTitle={task.title}
        onOpenChange={setDeleteConfirmOpen}
        onDeleted={handleDeleteConfirm}
      />
    </>
  );
}

export default memo(OneTimeTaskItem);
