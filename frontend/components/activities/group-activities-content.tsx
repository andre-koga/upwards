"use client";

import { useState, useEffect, useCallback } from "react";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { PATTERN_OPTIONS } from "@/lib/colors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ActivityGroup = Tables<"activity_groups">;
type Activity = Tables<"activities">;

interface GroupActivitiesContentProps {
  userId: string;
  group: ActivityGroup;
}

export default function GroupActivitiesContent({
  userId,
  group,
}: GroupActivitiesContentProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string | null;
  }>({ open: false, activityId: null, activityName: null });

  const supabase = createClient();

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", group.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setActivities(data || []);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, group.id, supabase]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const getPatternDisplay = (pattern: string | null) => {
    if (!pattern) return null;
    const patternOption = PATTERN_OPTIONS.find((p) => p.value === pattern);
    return patternOption?.name || pattern;
  };

  const getRoutineDisplay = (routine: string | null) => {
    if (!routine) return "Daily";

    if (routine.startsWith("weekly:")) {
      const days = routine.split(":")[1];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayNumbers = days.split(",").map(Number);
      return `Weekly: ${dayNumbers.map((d) => dayNames[d]).join(", ")}`;
    } else if (routine.startsWith("monthly:")) {
      const day = routine.split(":")[1];
      return `Monthly: Day ${day}`;
    } else if (routine.startsWith("custom:")) {
      const parts = routine.split(":");
      return `Every ${parts[1]} ${parts[2]}`;
    }

    return routine.charAt(0).toUpperCase() + routine.slice(1);
  };

  const stopCurrentActivity = async (activityId: string) => {
    try {
      // Get today's daily entry
      const today = new Date().toISOString().split("T")[0];
      const { data: dailyEntry } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!dailyEntry || dailyEntry.current_activity_id !== activityId) {
        return; // Not currently active
      }

      const now = new Date();

      // Close current activity period
      const { data: currentPeriod } = await supabase
        .from("activity_periods")
        .select("*")
        .eq("daily_entry_id", dailyEntry.id)
        .is("end_time", null)
        .maybeSingle();

      if (currentPeriod) {
        await supabase
          .from("activity_periods")
          .update({ end_time: now.toISOString() })
          .eq("id", currentPeriod.id);
      }

      // Clear current activity
      await supabase
        .from("daily_entries")
        .update({ current_activity_id: null })
        .eq("id", dailyEntry.id);
    } catch (error) {
      console.error("Error stopping current activity:", error);
    }
  };

  const handleArchive = async () => {
    if (!archiveDialog.activityId) return;

    try {
      // Stop current activity if this one is active
      await stopCurrentActivity(archiveDialog.activityId);

      const { error } = await supabase
        .from("activities")
        .update({ is_archived: true })
        .eq("id", archiveDialog.activityId);

      if (error) throw error;

      setArchiveDialog({ open: false, activityId: null, activityName: null });
      await loadActivities();
    } catch (error) {
      console.error("Error archiving activity:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push("/activities")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/activities/${group.id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Group
          </Button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-4xl"
            style={{ backgroundColor: group.color || "#000" }}
          >
            {group.emoji || ""}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
            <p className="text-muted-foreground">
              {activities.length}{" "}
              {activities.length === 1 ? "activity" : "activities"}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/activities/${group.id}/new`)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm mb-6"
        >
          <span>New Activity</span>
          <Plus className="h-4 w-4 shrink-0" />
        </button>

        {activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No activities yet. Create your first activity for this group!
              </p>
              <Button
                onClick={() => router.push(`/activities/${group.id}/new`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Activity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-medium truncate">{activity.name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {activity.pattern && (
                      <Badge variant="secondary" className="text-xs">
                        {getPatternDisplay(activity.pattern)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {getRoutineDisplay(activity.routine)}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      router.push(`/activities/${group.id}/edit/${activity.id}`)
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setArchiveDialog({
                        open: true,
                        activityId: activity.id,
                        activityName: activity.name,
                      })
                    }
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive Confirmation Dialog */}
      <AlertDialog
        open={archiveDialog.open}
        onOpenChange={(open) =>
          !open &&
          setArchiveDialog({
            open: false,
            activityId: null,
            activityName: null,
          })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{archiveDialog.activityName}"?
              This will remove it from your active activities list. You can view
              archived activities later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
