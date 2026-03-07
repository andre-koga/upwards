import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
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
    <div className="p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-lg flex-shrink-0"
                style={{ backgroundColor: group.color || "#000" }}
              />
              <div>
                <p className="text-sm text-muted-foreground">{group.name}</p>
                <CardTitle>
                  {isEditing ? "Edit Activity" : "Create New Activity"}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ActivityFormFields
              initialData={activity}
              onSubmit={handleSubmit}
              onCancel={() => navigate(-1)}
              submitLabel={isEditing ? "Update Activity" : "Create Activity"}
              isSubmitting={isSubmitting}
              error={error}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
