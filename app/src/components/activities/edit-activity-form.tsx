import { useState } from "react";
import { db, now } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import ActivityFormFields from "@/components/activities/activity-form-fields";

interface EditActivityFormProps {
  group: ActivityGroup;
  activity: Activity;
}

export default function EditActivityForm({
  group,
  activity,
}: EditActivityFormProps) {
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
      await db.activities.update(activity.id, {
        name: data.name.trim(),
        pattern: data.pattern,
        routine: data.routine,
        completion_target: data.completion_target,
        updated_at: now(),
      });
    } catch (error) {
      console.error("Error updating activity:", error);
      setError("Failed to update activity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActivityFormFields
      group={group}
      initialData={activity}
      onSubmit={handleSubmit}
      submitLabel="Update Activity"
      isSubmitting={isSubmitting}
      error={error}
      backPath={`/activities/${group.id}`}
    />
  );
}
