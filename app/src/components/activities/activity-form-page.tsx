import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, now, newId } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import ActivityFormFields from "@/components/activities/activity-form-fields";

interface ActivitySubmitData {
  name: string;
  pattern: string;
  routine: string;
  completion_target: number;
}

interface ActivityFormPageProps {
  group: ActivityGroup;
  activity?: Activity; // present → edit mode, absent → create mode
}

function validateActivityData(data: ActivitySubmitData): string | null {
  if (!data.name.trim()) return "Activity name is required";
  if (data.routine.startsWith("weekly:")) {
    const days = data.routine.split(":")[1];
    if (!days || days.split(",").length === 0)
      return "Please select at least one day for weekly routine";
  }
  return null;
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
          pattern: data.pattern,
          routine: data.routine,
          completion_target: data.completion_target,
          updated_at: now(),
        });
      } else {
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
      }
      navigate(`/activities/${group.id}`);
    } catch (err) {
      console.error("Error saving activity:", err);
      setError("Failed to save activity. Please try again.");
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
