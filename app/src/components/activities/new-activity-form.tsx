import { useState } from "react";
import { db, now, newId } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import ActivityFormFields from "@/components/activities/activity-form-fields";

interface NewActivityFormProps {
  group: ActivityGroup;
}

export default function NewActivityForm({ group }: NewActivityFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: {
    name: string;
    pattern: string;
    routine: string;
    completion_target: number;
  }) => {
    setError(null);

    if (!data.name.trim()) {
      setError("Activity name is required");
      return;
    }

    if (data.routine.startsWith("weekly:")) {
      const days = data.routine.split(":")[1];
      if (!days || days.split(",").length === 0) {
        setError("Please select at least one day for weekly routine");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const n = now();
      await db.activities.add({
        id: newId(),
        group_id: group.id,
        name: data.name.trim(),
        pattern: data.pattern,
        routine: data.routine,
        completion_target: data.completion_target,
        color: null,
        is_archived: false,
        order_index: null,
        created_at: n,
        updated_at: n,
        synced_at: null,
        deleted_at: null,
      });
    } catch (error) {
      console.error("Error creating activity:", error);
      setError("Failed to create activity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActivityFormFields
      group={group}
      onSubmit={handleSubmit}
      submitLabel="Create Activity"
      isSubmitting={isSubmitting}
      error={error}
      backPath={`/activities/${group.id}`}
    />
  );
}
