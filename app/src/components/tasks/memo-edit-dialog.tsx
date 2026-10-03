import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FormCharacterCount,
  FormCalendarDateField,
  FormDialog,
  FormDialogActions,
  FormRow,
  FormStack,
  FormTextareaField,
  FormToggleButton,
} from "@/components/forms";
import { Archive, MoreHorizontal, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onArchive?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  titlePlaceholder?: string;
  showAdvancedToggle?: boolean;
  advancedLabel?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

export function MemoEditDialog({
  open,
  onOpenChange,
  dialogTitle,
  title,
  onTitleChange,
  dueDate,
  onDueDateChange,
  isPinned,
  onPinnedChange,
  onConfirm,
  onDelete,
  onArchive,
  confirmLabel,
  confirmDisabled = false,
  titlePlaceholder,
  showAdvancedToggle = false,
  advancedLabel,
  secondaryAction,
}: MemoEditDialogProps) {
  const { t } = useTranslation("tasks");
  const { t: tCommon } = useTranslation("common");
  const [advancedOpen, setAdvancedOpen] = useState(!showAdvancedToggle);
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
      title={dialogTitle ?? t("memo.editTitle")}
      contentClassName="w-80"
      headerEnd={
        onArchive ? (
          <Button
            type="button"
            variant="destructiveOutline"
            size="iconRoundSm"
            className="shrink-0"
            onClick={onArchive}
            title={t("memo.archive")}
            aria-label={t("memo.archive")}
          >
            <Archive className="h-4 w-4" aria-hidden />
          </Button>
        ) : undefined
      }
    >
      <FormStack className="space-y-2">
        <FormTextareaField
          id="memo-title"
          label={t("memo.titleLabel")}
          labelClassName="sr-only"
          autoFocus
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={titlePlaceholder ?? t("memo.titlePlaceholder")}
          maxLength={MEMO_TITLE_LIMIT}
          rows={5}
          message={
            <FormCharacterCount current={title.length} max={MEMO_TITLE_LIMIT} />
          }
        />
        {showAdvancedToggle ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9 justify-start gap-2 px-2 text-xs text-muted-foreground"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            {advancedLabel ?? t("memo.moreOptions")}
          </Button>
        ) : null}
        {advancedOpen ? (
          <FormRow>
            <FormCalendarDateField
              id="memo-due-date"
              label={t("memo.dueDate")}
              labelClassName="sr-only"
              value={dueDate ?? ""}
              onValueChange={(value) => onDueDateChange(value || null)}
              containerClassName="flex-1 space-y-0"
              placeholder={t("memo.dueDate")}
              clearable
            />
            <FormToggleButton
              toggled={isPinned}
              onToggle={onPinnedChange}
              label={isPinned ? t("memo.unpin") : t("memo.pin")}
            >
              <Pin className={isPinned ? "h-4 w-4 fill-current" : "h-4 w-4"} />
            </FormToggleButton>
          </FormRow>
        ) : null}
      </FormStack>
      <FormDialogActions
        onConfirm={onConfirm}
        confirmLabel={confirmLabel ?? tCommon("save")}
        confirmDisabled={confirmDisabled}
        secondaryAction={
          secondaryAction
            ? secondaryAction
            : onDelete
              ? {
                  label: tCommon("delete"),
                  onClick: onDelete,
                  destructive: true,
                }
              : undefined
        }
      />
    </FormDialog>
  );
}
