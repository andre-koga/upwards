import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
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
  const navigate = useNavigate();
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
      navigate(`/activities/${group.id}`);
    } catch (error) {
      console.error("Error updating activity:", error);
      setError("Failed to update activity. Please try again.");
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
                className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl"
                style={{ backgroundColor: group.color || "#000" }}
              >
                {group.emoji || ""}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{group.name}</p>
                <CardTitle>Edit Activity</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ActivityFormFields
              initialData={activity}
              onSubmit={handleSubmit}
              onCancel={() => navigate(-1)}
              submitLabel="Update Activity"
              isSubmitting={isSubmitting}
              error={error}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
