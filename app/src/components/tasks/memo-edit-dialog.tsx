import {
  FormCharacterCount,
  FormDateField,
  FormDialog,
  FormDialogActions,
  FormRow,
  FormStack,
  FormTextareaField,
  FormToggleButton,
} from "@/components/forms";
import { Pin } from "lucide-react";
import { MEMO_TITLE_LIMIT } from "@/components/tasks/memo-title";

interface MemoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogTitle?: string;
  title: string;
  onTitleChange: (value: string) => void;
  dueDate: string | null;
  onDueDateChange: (value: string | null) => void;
  isPinned: boolean;
  onPinnedChange: (value: boolean) => void;
  onConfirm: () => void;
  onDelete?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

export function MemoEditDialog({
  open,
  onOpenChange,
  dialogTitle = "Edit memo",
  title,
  onTitleChange,
  dueDate,
  onDueDateChange,
  isPinned,
  onPinnedChange,
  onConfirm,
  onDelete,
  confirmLabel = "Save",
  confirmDisabled = false,
}: MemoEditDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onConfirm();
    }
    if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      contentClassName="w-80"
    >
      <FormStack className="space-y-2">
        <FormTextareaField
          id="memo-title"
          label="Memo title"
          labelClassName="sr-only"
          autoFocus
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Task title…"
          maxLength={MEMO_TITLE_LIMIT}
          rows={5}
          message={
            <FormCharacterCount current={title.length} max={MEMO_TITLE_LIMIT} />
          }
        />
        <FormRow>
          <FormDateField
            id="memo-due-date"
            label="Due date"
            labelClassName="sr-only"
            value={dueDate ?? ""}
            onChange={(e) => onDueDateChange(e.target.value || null)}
            containerClassName="flex-1 space-y-0"
          />
          <FormToggleButton
            toggled={isPinned}
            onToggle={onPinnedChange}
            label={isPinned ? "Unpin memo" : "Pin memo"}
          >
            <Pin className={isPinned ? "h-4 w-4 fill-current" : "h-4 w-4"} />
          </FormToggleButton>
        </FormRow>
      </FormStack>
      <FormDialogActions
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        confirmDisabled={confirmDisabled}
        secondaryAction={
          onDelete
            ? {
                label: "Delete",
                onClick: onDelete,
                destructive: true,
              }
            : undefined
        }
      />
    </FormDialog>
  );
}
