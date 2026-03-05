"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables, TablesInsert } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Archive, Plus, Play, Square } from "lucide-react";
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

interface ActivitiesManagerProps {
  userId: string;
  groups: ActivityGroup[];
  activities: Activity[];
  onActivitiesChange: () => void;
  onStartTimer?: (activityId: string) => void;
  activeTimerId?: string | null;
}

export default function ActivitiesManager({
  userId,
  groups,
  activities,
  onActivitiesChange,
  onStartTimer,
  activeTimerId,
}: ActivitiesManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    activityId: string | null;
  }>({ open: false, activityId: null });
  const [formData, setFormData] = useState({
    name: "",
    pattern: "solid",
    group_id: "",
    routine: "daily",
    weeklyDays: [] as number[], // 0 = Sunday, 1 = Monday, etc.
    monthlyDay: 1, // Day of month (1-31)
    customInterval: 1,
    customUnit: "days" as "days" | "weeks" | "months",
  });

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Build routine config string
      let routineConfig = formData.routine;
      if (formData.routine === "weekly" && formData.weeklyDays.length > 0) {
        routineConfig = `weekly:${formData.weeklyDays.sort().join(",")}`;
      } else if (formData.routine === "monthly") {
        routineConfig = `monthly:${formData.monthlyDay}`;
      } else if (formData.routine === "custom") {
        routineConfig = `custom:${formData.customInterval}:${formData.customUnit}`;
      }

      if (editingId) {
        // Update existing activity
        const { error } = await supabase
          .from("activities")
          .update({
            name: formData.name,
            pattern: formData.pattern,
            group_id: formData.group_id,
            routine: routineConfig,
          })
          .eq("id", editingId);

        if (error) throw error;
        setEditingId(null);
      } else {
        // Create new activity
        const insertPayload: TablesInsert<"activities"> = {
          user_id: userId,
          name: formData.name,
          pattern: formData.pattern,
          group_id: formData.group_id,
          routine: routineConfig,
        };

        const { error } = await supabase
          .from("activities")
          .insert(insertPayload);

        if (error) throw error;
        setIsAdding(false);
      }

      setFormData({
        name: "",
        pattern: "solid",
        group_id: "",
        routine: "daily",
        weeklyDays: [],
        monthlyDay: 1,
        customInterval: 1,
        customUnit: "days",
      });
      onActivitiesChange();
    } catch (error) {
      console.error("Error saving activity:", error);
    }
  };

  const handleEdit = (activity: Activity) => {
    setEditingId(activity.id);

    // Parse routine config
    const routine = activity.routine || "daily";
    let baseRoutine = routine;
    let weeklyDays: number[] = [];
    let monthlyDay = 1;
    let customInterval = 1;
    let customUnit: "days" | "weeks" | "months" = "days";

    if (routine.startsWith("weekly:")) {
      baseRoutine = "weekly";
      const days = routine.split(":")[1];
      weeklyDays = days ? days.split(",").map(Number) : [];
    } else if (routine.startsWith("monthly:")) {
      baseRoutine = "monthly";
      monthlyDay = parseInt(routine.split(":")[1]) || 1;
    } else if (routine.startsWith("custom:")) {
      baseRoutine = "custom";
      const parts = routine.split(":");
      customInterval = parseInt(parts[1]) || 1;
      customUnit = (parts[2] as "days" | "weeks" | "months") || "days";
    }

    setFormData({
      name: activity.name || "",
      pattern: activity.pattern || "solid",
      group_id: activity.group_id,
      routine: baseRoutine,
      weeklyDays,
      monthlyDay,
      customInterval,
      customUnit,
    });
    setIsAdding(true);
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

  const handleArchive = async (id: string) => {
    setArchiveDialog({ open: true, activityId: id });
  };

  const confirmArchive = async () => {
    if (!archiveDialog.activityId) return;

    try {
      // Stop current activity if this one is active
      await stopCurrentActivity(archiveDialog.activityId);

      const { error } = await supabase
        .from("activities")
        .update({ is_archived: true })
        .eq("id", archiveDialog.activityId);

      if (error) throw error;
      setArchiveDialog({ open: false, activityId: null });
      onActivitiesChange();
    } catch (error) {
      console.error("Error archiving activity:", error);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: "",
      pattern: "solid",
      group_id: "",
      routine: "daily",
      weeklyDays: [],
      monthlyDay: 1,
      customInterval: 1,
      customUnit: "days",
    });
  };

  const toggleWeekday = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      weeklyDays: prev.weeklyDays.includes(day)
        ? prev.weeklyDays.filter((d) => d !== day)
        : [...prev.weeklyDays, day],
    }));
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

  const getGroupName = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group?.name || "Unknown";
  };

  const getGroupColor = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group?.color || "#6b7280";
  };

  const groupedActivities = groups.map((group) => ({
    group,
    activities: activities.filter((a) => a.group_id === group.id),
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Activities & Habits</CardTitle>
        {!isAdding && groups.length > 0 && (
          <Button
            size="icon"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2"
          >
            <Plus />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Create a group first to add activities!
          </p>
        )}

        {isAdding && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 p-4 border rounded-md"
          >
            <div>
              <Label htmlFor="activity-name">Activity Name</Label>
              <Input
                id="activity-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Morning Exercise, Read Book"
                required
              />
            </div>
            <div>
              <Label htmlFor="group">Group</Label>
              <select
                id="group"
                value={formData.group_id}
                onChange={(e) =>
                  setFormData({ ...formData, group_id: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select a group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="routine">Routine</Label>
              <select
                id="routine"
                value={formData.routine}
                onChange={(e) =>
                  setFormData({ ...formData, routine: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="anytime">Anytime (no schedule)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
                <option value="never">Never (avoid this)</option>
              </select>

              {/* Weekly days selection */}
              {formData.routine === "weekly" && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm">Select days:</Label>
                  <div className="flex gap-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day, index) => (
                        <Button
                          key={day}
                          type="button"
                          size="sm"
                          variant={
                            formData.weeklyDays.includes(index)
                              ? "default"
                              : "outline"
                          }
                          onClick={() => toggleWeekday(index)}
                          className="w-12"
                        >
                          {day}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Monthly day selection */}
              {formData.routine === "monthly" && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="monthlyDay" className="text-sm">
                    Day of month:
                  </Label>
                  <Input
                    id="monthlyDay"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.monthlyDay}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyDay: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-24"
                  />
                </div>
              )}

              {/* Custom interval selection */}
              {formData.routine === "custom" && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm">Every:</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      min="1"
                      value={formData.customInterval}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customInterval: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-20"
                    />
                    <select
                      value={formData.customUnit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customUnit: e.target.value as
                            | "days"
                            | "weeks"
                            | "months",
                        })
                      }
                      className="px-3 py-2 border rounded-md flex-1"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label>Pattern</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {PATTERN_OPTIONS.map((pattern) => (
                  <button
                    key={pattern.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, pattern: pattern.value })
                    }
                    className={`px-3 py-2 rounded-md border-2 transition-all text-sm ${
                      formData.pattern === pattern.value
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-muted hover:border-muted-foreground"
                    }`}
                  >
                    {pattern.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {editingId ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {groupedActivities.map(({ group, activities: groupActivities }) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: group.color || "#3b82f6" }}
                />
                {group.emoji && (
                  <span className="text-sm leading-none">{group.emoji}</span>
                )}
                <h3 className="font-semibold text-sm">{group.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {groupActivities.length}
                </Badge>
              </div>
              {groupActivities.length === 0 ? (
                <p className="text-xs text-muted-foreground ml-5">
                  No activities in this group yet
                </p>
              ) : (
                <div className="space-y-1 ml-5">
                  {groupActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-2 border rounded-md hover:bg-accent"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="w-3 h-3 rounded"
                          style={{
                            backgroundColor: group.color || "#3b82f6",
                          }}
                          title={`Pattern: ${activity.pattern || "solid"}`}
                        />
                        <span className="text-sm">{activity.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {formatRoutineDisplay(activity.routine)}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        {onStartTimer && (
                          <Button
                            size="sm"
                            variant={
                              activeTimerId === activity.id
                                ? "default"
                                : "ghost"
                            }
                            onClick={() => onStartTimer(activity.id)}
                            title={
                              activeTimerId === activity.id
                                ? "Timer running"
                                : "Start timer"
                            }
                          >
                            {activeTimerId === activity.id ? (
                              <Square className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(activity)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(activity.id)}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog
        open={archiveDialog.open}
        onOpenChange={(open) =>
          setArchiveDialog({ open, activityId: archiveDialog.activityId })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this activity? You can unarchive
              it later from Settings &gt; Archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
