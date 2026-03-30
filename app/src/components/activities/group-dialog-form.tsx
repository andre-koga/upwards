import { useEffect, useState } from "react";
import { FormDialog, FormDialogActions, FormStack } from "@/components/forms";
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

interface GroupDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  initialData?: Partial<GroupDialogFormData>;
  onSubmit: (data: GroupDialogFormData) => Promise<void>;
}

export function GroupDialogForm({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialData,
  onSubmit,
}: GroupDialogFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [color, setColor] = useState(initialData?.color ?? DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onSubmit({ name: trimmedName, color });
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
          showPreview={false}
          nameInputAutoFocus
          nameInputMaxLength={60}
        />

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
