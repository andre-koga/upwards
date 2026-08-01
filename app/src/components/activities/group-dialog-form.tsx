import { useEffect, useState, type ReactNode } from "react";
import { FormDialog, FormDialogActions, FormStack } from "@/components/forms";
import {
  DefinitionEffectiveFromField,
  useDefinitionEffectiveFromState,
} from "@/components/forms/definition-effective-from-field";
import {
  dialogFieldClassName,
  dialogFieldLabelClassName,
} from "@/components/forms/styles";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import { GroupNameColorFields } from "@/components/activities/group-name-color-fields";

const DEFAULT_COLOR = "#3b82f6";

interface GroupDialogFormData {
  name: string;
  color: string;
}

interface GroupDialogFormSubmitData extends GroupDialogFormData {
  effectiveFrom?: string;
}

interface GroupDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  initialData?: Partial<GroupDialogFormData>;
  onSubmit: (data: GroupDialogFormSubmitData) => Promise<void>;
  headerEnd?: ReactNode;
  /** When set, shows effective-date controls for definition edits. */
  definitionEdit?: {
    createdAt: string;
  };
}

export function GroupDialogForm({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialData,
  onSubmit,
  headerEnd,
  definitionEdit,
}: GroupDialogFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [color, setColor] = useState(initialData?.color ?? DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveFromControl = useDefinitionEffectiveFromState(
    definitionEdit?.createdAt ?? "",
    definitionEdit && open ? definitionEdit.createdAt : undefined
  );

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- resetting local draft values on dialog open */
    setName(initialData?.name ?? "");
    setColor(initialData?.color ?? DEFAULT_COLOR);
    setError(null);
    setSaving(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialData?.name, initialData?.color]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null);
      setSaving(false);
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Group name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        name: trimmedName,
        color,
        ...(definitionEdit
          ? { effectiveFrom: effectiveFromControl.effectiveFrom }
          : {}),
      });
      handleOpenChange(false);
    } catch {
      setError(ERROR_MESSAGES.SAVE_GROUP);
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      headerEnd={headerEnd}
      contentClassName="sm:max-w-md"
    >
      <FormStack>
        <GroupNameColorFields
          name={name}
          color={color}
          onNameChange={setName}
          onColorChange={setColor}
          sectionLabelClassName={dialogFieldLabelClassName}
          nameInputClassName={dialogFieldClassName}
          nameInputAutoFocus
          nameInputMaxLength={60}
        />

        {definitionEdit ? (
          <DefinitionEffectiveFromField
            idPrefix="group-definition"
            createdAt={definitionEdit.createdAt}
            variant="group"
            mode={effectiveFromControl.state.mode}
            onModeChange={effectiveFromControl.setMode}
            customDate={effectiveFromControl.state.customDate}
            onCustomDateChange={effectiveFromControl.setCustomDate}
            disabled={saving}
          />
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <FormDialogActions
          onConfirm={handleConfirm}
          confirmLabel={saving ? `${confirmLabel}...` : confirmLabel}
          confirmDisabled={saving || !name.trim()}
          secondaryAction={{
            label: "Cancel",
            onClick: () => handleOpenChange(false),
            disabled: saving,
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
