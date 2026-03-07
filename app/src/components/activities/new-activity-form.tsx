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
      await db.transaction("rw", db.activities, async () => {
        const shouldAssignOrderIndex =
          data.routine !== "anytime" && data.routine !== "never";

        let nextOrderIndex: number | null = null;
        if (shouldAssignOrderIndex) {
          const scheduledActivities = await db.activities
            .filter(
              (item) =>
                !item.is_archived &&
                !item.deleted_at &&
                item.routine !== "anytime" &&
                item.routine !== "never",
            )
            .toArray();

          const maxOrderIndex = scheduledActivities.reduce(
            (max, item) =>
              typeof item.order_index === "number"
                ? Math.max(max, item.order_index)
                : max,
            -1,
          );
          nextOrderIndex = maxOrderIndex + 1;
        }

        await db.activities.add({
          id: newId(),
          group_id: group.id,
          name: data.name.trim(),
          pattern: null,
          routine: data.routine,
          completion_target: data.completion_target,
          color: null,
          is_archived: false,
          order_index: nextOrderIndex,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        });
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
