/**
 * SRP: Renders the page-based group form wrapper and submit handling.
 */
import { useState } from "react";
import FormPageLayout from "@/components/ui/form-page-layout";
import { formSectionLabel, formInput } from "@/lib/form-styles";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import { GroupNameColorFields } from "@/components/activities/group-name-color-fields";

const DEFAULT_COLOR = "#3b82f6";

export interface GroupFormData {
  name: string;
  color: string;
}

interface GroupFormFieldsProps {
  initialData?: Partial<GroupFormData>;
  submitLabel: string;
  onSubmit: (data: GroupFormData) => Promise<void>;
  backPath?: string;
}

export default function GroupFormFields({
  initialData,
  submitLabel,
  onSubmit,
  backPath = "/",
}: GroupFormFieldsProps) {
  const initialHex = initialData?.color ?? DEFAULT_COLOR;
  const [formData, setFormData] = useState<GroupFormData>({
    name: initialData?.name ?? "",
    color: initialHex,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) {
      setError("Group name is required");
      return;
    }
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
    } catch {
      setError(ERROR_MESSAGES.SAVE_GROUP);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormPageLayout
      formId="group-form"
      onSubmit={handleSubmit}
      backPath={backPath}
      submitLabel={submitLabel}
      isSubmitting={isSubmitting}
      submitDisabled={!formData.name.trim()}
      error={error}
    >
      <div className="flex flex-1 flex-col justify-center gap-3">
        <GroupNameColorFields
          name={formData.name}
          color={formData.color}
          onNameChange={(name) => setFormData((prev) => ({ ...prev, name }))}
          onColorChange={(color) => setFormData((prev) => ({ ...prev, color }))}
          sectionLabelClassName={formSectionLabel}
          nameInputClassName={formInput}
        />
      </div>
    </FormPageLayout>
  );
}
