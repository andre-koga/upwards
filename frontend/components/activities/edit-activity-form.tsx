"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import ActivityFormFields from "@/components/activities/activity-form-fields";

type ActivityGroup = Tables<"activity_groups">;
type Activity = Tables<"activities">;

interface EditActivityFormProps {
  userId: string;
  group: ActivityGroup;
  activity: Activity;
}

export default function EditActivityForm({
  userId,
  group,
  activity,
}: EditActivityFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

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

    // Validate weekly days if routine is weekly
    if (data.routine.startsWith("weekly:")) {
      const days = data.routine.split(":")[1];
      if (!days || days.split(",").length === 0) {
        setError("Please select at least one day for weekly routine");
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const { error: updateError } = await supabase
        .from("activities")
        .update({
          name: data.name,
          pattern: data.pattern,
          routine: data.routine,
          completion_target: data.completion_target,
        })
        .eq("id", activity.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      // Redirect back to group page
      router.push(`/activities/${group.id}`);
      router.refresh();
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
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
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
              onCancel={() => router.back()}
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
