"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type Activity = Tables<"activities">;
type ActivityGroup = Tables<"activity_groups">;

interface ArchivedItemsProps {
  userId: string;
}

export default function ArchivedItems({ userId }: ArchivedItemsProps) {
  const [archivedGroups, setArchivedGroups] = useState<ActivityGroup[]>([]);
  const [archivedActivities, setArchivedActivities] = useState<Activity[]>([]);
  const [allGroups, setAllGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "activity" | "group" | null;
    id: string | null;
  }>({ open: false, type: null, id: null });

  const supabase = createClient();

  const loadArchivedItems = useCallback(async () => {
    try {
      setLoading(true);

      const [groupsData, activitiesData, allGroupsData] = await Promise.all([
        supabase
          .from("activity_groups")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("activity_groups")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      ]);

      if (groupsData.error) throw groupsData.error;
      if (activitiesData.error) throw activitiesData.error;
      if (allGroupsData.error) throw allGroupsData.error;

      setArchivedGroups(groupsData.data || []);
      setArchivedActivities(activitiesData.data || []);
      setAllGroups(allGroupsData.data || []);
    } catch (error) {
      console.error("Error loading archived items:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadArchivedItems();
  }, [loadArchivedItems]);

  const handleUnarchiveGroup = async (id: string) => {
    try {
      // Unarchive the group
      const { error: groupError } = await supabase
        .from("activity_groups")
        .update({ is_archived: false })
        .eq("id", id);

      if (groupError) throw groupError;

      // Unarchive all activities in this group
      const { error: activitiesError } = await supabase
        .from("activities")
        .update({ is_archived: false })
        .eq("group_id", id);

      if (activitiesError) throw activitiesError;

      loadArchivedItems();
    } catch (error) {
      console.error("Error unarchiving group:", error);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setDeleteDialog({ open: true, type: "group", id });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.type) return;

    try {
      if (deleteDialog.type === "group") {
        // Stop current activity if it belongs to this group
        await stopCurrentActivity(undefined, deleteDialog.id);

        const { error } = await supabase
          .from("activity_groups")
          .delete()
          .eq("id", deleteDialog.id);

        if (error) throw error;
      } else if (deleteDialog.type === "activity") {
        // Stop current activity if it's the one being deleted
        await stopCurrentActivity(deleteDialog.id, undefined);

        const { error } = await supabase
          .from("activities")
          .delete()
          .eq("id", deleteDialog.id);

        if (error) throw error;
      }

      setDeleteDialog({ open: false, type: null, id: null });
      loadArchivedItems();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const handleUnarchiveActivity = async (id: string) => {
    try {
      // Get the activity to find its group
      const activity = archivedActivities.find((a) => a.id === id);
      if (!activity) return;

      // Check if the group is archived
      const group = allGroups.find((g) => g.id === activity.group_id);
      if (group?.is_archived) {
        // Unarchive the group first
        const { error: groupError } = await supabase
          .from("activity_groups")
          .update({ is_archived: false })
          .eq("id", group.id);

        if (groupError) throw groupError;
      }

      // Unarchive the activity
      const { error } = await supabase
        .from("activities")
        .update({ is_archived: false })
        .eq("id", id);

      if (error) throw error;
      loadArchivedItems();
    } catch (error) {
      console.error("Error unarchiving activity:", error);
    }
  };

  const stopCurrentActivity = async (activityId?: string, groupId?: string) => {
    try {
      // Get today's daily entry
      const today = new Date().toISOString().split("T")[0];
      const { data: dailyEntry } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!dailyEntry || !dailyEntry.current_activity_id) return;

      let shouldStop = false;

      if (activityId) {
        // Check if the specific activity is currently active
        shouldStop = dailyEntry.current_activity_id === activityId;
      } else if (groupId) {
        // Check if current activity belongs to the group being deleted
        const { data: currentActivity } = await supabase
          .from("activities")
          .select("*")
          .eq("id", dailyEntry.current_activity_id)
          .maybeSingle();

        shouldStop = currentActivity?.group_id === groupId;
      }

      if (!shouldStop) return;

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

  const handleDeleteActivity = async (id: string) => {
    setDeleteDialog({ open: true, type: "activity", id });
  };

  const getGroupName = (groupId: string) => {
    const group = allGroups.find((g) => g.id === groupId);
    return group?.name || "Unknown";
  };

  const getGroupColor = (groupId: string) => {
    const group = allGroups.find((g) => g.id === groupId);
    return group?.color || "#6b7280";
  };

  const getPatternLabel = (pattern: string | null) => {
    const patternOption = PATTERN_OPTIONS.find((p) => p.value === pattern);
    return patternOption?.name || "Solid";
  };

  const formatRoutineDisplay = (routine: string | null) => {
    if (!routine) return "daily";

    if (routine === "anytime") return "anytime";
    if (routine === "never") return "never";

    if (routine.startsWith("weekly:")) {
      const days = routine.split(":")[1].split(",").map(Number);
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      return `weekly: ${days.map((d) => dayNames[d]).join(", ")}`;
    } else if (routine.startsWith("monthly:")) {
      const day = routine.split(":")[1];
      return `monthly: day ${day}`;
    } else if (routine.startsWith("custom:")) {
      const parts = routine.split(":");
      return `every ${parts[1]} ${parts[2]}`;
    }

    return routine;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading archived items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Archived Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Archived Groups</CardTitle>
        </CardHeader>
        <CardContent>
          {archivedGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No archived groups.
            </p>
          ) : (
            <div className="space-y-2">
              {archivedGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: group.color || "#6b7280" }}
                    />
                    <span className="font-medium">{group.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnarchiveGroup(group.id)}
                      title="Unarchive group"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteGroup(group.id)}
                      title="Permanently delete group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archived Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Archived Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {archivedActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No archived activities.
            </p>
          ) : (
            <div className="space-y-2">
              {archivedActivities.map((activity) => {
                const groupName = getGroupName(activity.group_id);

                return (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{activity.name}</span>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: getGroupColor(activity.group_id),
                          }}
                        >
                          {groupName}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Pattern: {getPatternLabel(activity.pattern)} • Routine:{" "}
                        {formatRoutineDisplay(activity.routine)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnarchiveActivity(activity.id)}
                        title="Unarchive activity"
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteActivity(activity.id)}
                        title="Permanently delete activity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently Delete{" "}
              {deleteDialog.type === "group" ? "Group" : "Activity"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{" "}
              {deleteDialog.type === "group"
                ? "group and all activities in it"
                : "activity"}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
