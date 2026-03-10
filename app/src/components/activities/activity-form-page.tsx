import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, now, newId } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import {
  validateActivityData,
  type ActivitySubmitData,
} from "@/lib/activity-validation";
import { isActiveActivity, isScheduledRoutine } from "@/lib/activity-utils";
import { ERROR_MESSAGES } from "@/lib/error-utils";
import ActivityFormFields from "@/components/activities/activity-form-fields";

interface ActivityFormPageProps {
  group: ActivityGroup;
  activity?: Activity; // present → edit mode, absent → create mode
}

export default function ActivityFormPage({
  group,
  activity,
}: ActivityFormPageProps) {
  const navigate = useNavigate();
  const isEditing = !!activity;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: ActivitySubmitData) => {
    setError(null);
    const validationError = validateActivityData(data);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing) {
        await db.activities.update(activity.id, {
          name: data.name.trim(),
          routine: data.routine,
          completion_target: data.completion_target,
          updated_at: now(),
        });
      } else {
        const n = now();
        await db.transaction("rw", db.activities, async () => {
          const shouldAssignOrderIndex = isScheduledRoutine(data.routine);

          let nextOrderIndex: number | null = null;
          if (shouldAssignOrderIndex) {
            const scheduledActivities = await db.activities
              .filter(
                (item) =>
                  isActiveActivity(item) &&
                  isScheduledRoutine(item.routine ?? "")
              )
              .toArray();

            const maxOrderIndex = scheduledActivities.reduce(
              (max, item) =>
                typeof item.order_index === "number"
                  ? Math.max(max, item.order_index)
                  : max,
              -1
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
      }
      navigate(`/activities/${group.id}`);
    } catch (err) {
      console.error("Error saving activity:", err);
      setError(ERROR_MESSAGES.SAVE_ACTIVITY);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActivityFormFields
      group={group}
      initialData={activity}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? "Update Activity" : "Create Activity"}
      isSubmitting={isSubmitting}
      error={error}
      backPath={`/activities/${group.id}`}
    />
  );
}
